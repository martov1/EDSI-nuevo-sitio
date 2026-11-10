/*
 * Seguimiento de clics de contacto y atribución de campañas
 * ========================================================
 *
 * Este archivo registra en una Web App de Google Apps Script los datos de
 * atribución asociados a los clics en enlaces de WhatsApp y de correo
 * electrónico. La finalidad es relacionar consultas que luego se convierten
 * fuera del sitio con la fuente/campaña que trajo al visitante.
 *
 * Flujo general:
 * 1. Al cargar cada página, recupera el estado de atribución de localStorage,
 *    cuenta la visita y guarda la primera página visitada.
 * 2. Si la URL actual contiene gclid, fbclid o parámetros UTM, actualiza el
 *    último origen/campaña identificable y lo conserva para otras páginas.
 * 3. Escucha clics en el documento y detecta si el enlace pulsado es de
 *    WhatsApp (wa.me/whatsapp.com) o de email (mailto:).
 * 4. Construye un payload con el contacto, los identificadores de campaña,
 *    la página de entrada y la página donde ocurrió el clic.
 * 5. Inicia un POST asíncrono a Apps Script y emite eventos a Google Tag
 *    Manager (dataLayer) y al Meta Pixel, si este último está instalado.
 *
 * El listener no cancela ni reemplaza la navegación del enlace: el navegador
 * abre WhatsApp o el cliente de correo usando el href original, sin esperar
 * al servidor. El POST usa keepalive para pedir al navegador que intente
 * mantener el envío aunque se abandone la página. Como se usa mode: "no-cors",
 * JavaScript no puede leer la respuesta ni confirmar que Apps Script escribió
 * la fila; el registro representa un clic/intención de contacto, no la prueba
 * de que el mensaje se haya enviado o de que haya ocurrido una venta.
 *
 * El estado de localStorage pertenece a este navegador y origen. No identifica
 * a una persona entre dispositivos/navegadores, y puede borrarse o bloquearse
 * según la configuración de privacidad del usuario.
 */
(function () {
  // Endpoint público de la Web App desplegada en Google Apps Script.
  // Debe aceptar solicitudes POST y procesar el objeto JSON enviado abajo.
  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbzJpD52mws24tAyjoCjzkZl8WBJ6h7YLBpAoWo2DbBDklRgXUN0lC3fouYtgZ3ZbzEiOw/exec";

  // Clave donde se conserva el estado de atribución entre páginas y visitas
  // del mismo navegador. Se guarda como JSON.
  const STORAGE_KEY = "edsi_contact_attribution";

  /**
   * Genera un código alfanumérico corto basado en la fecha y hora exacta (Timestamp).
   */
  function generarTicketID() {
    const ahora = new Date().getTime();
    return ahora.toString(36).toUpperCase();
  }

  /**
   * Lee un valor de localStorage.
   * Si el navegador bloquea el almacenamiento (por privacidad, modo privado
   * u otra política), registra el error y devuelve null para que el sitio
   * pueda seguir funcionando sin persistencia.
   */
  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn(
        "No se pudo leer el almacenamiento local de atribución.",
        error,
      );
      return null;
    }
  }

  /**
   * Guarda un valor en localStorage.
   * El fallo de persistencia se informa en consola, pero no bloquea la
   * interacción de contacto ni la carga del sitio.
   */
  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(
        "No se pudo guardar la atribución en este navegador.",
        error,
      );
    }
  }

  /**
   * Recupera y valida el estado previamente guardado.
   *
   * Se validan los campos que necesita el resto del script antes de confiar
   * en el JSON persistido. Si falta, está corrupto o tiene un formato
   * inesperado, comienza un estado limpio con cero visitas y sin último toque.
   */
  function getPageState() {
    const savedState = readStorage(STORAGE_KEY);
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState && typeof parsedState === "object") {
          const validLastTouch =
            parsedState.lastTouch === null ||
            (parsedState.lastTouch &&
              typeof parsedState.lastTouch === "object" &&
              typeof parsedState.lastTouch.gclid === "string" &&
              typeof parsedState.lastTouch.fbclid === "string" &&
              typeof parsedState.lastTouch.utmCampaign === "string" &&
              typeof parsedState.lastTouch.utmMedium === "string" &&
              typeof parsedState.lastTouch.utmSource === "string" &&
              typeof parsedState.lastTouch.utmTerm === "string" &&
              typeof parsedState.lastTouch.utmContent === "string" &&
              typeof parsedState.lastTouch.origin === "string");
          if (
            typeof parsedState.entryPage === "string" &&
            Number.isSafeInteger(parsedState.visits) &&
            parsedState.visits >= 0 &&
            validLastTouch
          ) {
            return parsedState;
          }
        }
        console.warn(
          "Estado de atribución inválido; se reinicia el seguimiento.",
        );
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        console.warn(
          "Estado de atribución inválido; se reinicia el seguimiento.",
        );
      }
    }

    return {
      entryPage: "",
      visits: 0,
      lastTouch: null,
    };
  }

  /**
   * Extrae de la URL los identificadores de anuncios y parámetros UTM.
   *
   * Devuelve null si la URL no contiene ninguno de esos parámetros. Si hay
   * datos de campaña, clasifica el origen como Google Ads o Meta Ads cuando
   * puede inferirlo; si no, conserva utm_source o usa "Directo / Orgánico".
   */
  function getTouchFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const touch = {
      gclid: params.get("gclid") || "",
      fbclid: params.get("fbclid") || "",
      utmCampaign: params.get("utm_campaign") || "",
      utmMedium: params.get("utm_medium") || "",
      utmSource: params.get("utm_source") || "",
      utmTerm: params.get("utm_term") || "",
      utmContent: params.get("utm_content") || "",
    };
    const hasTrackingParams = Object.values(touch).some(Boolean);

    if (!hasTrackingParams) return null;

    const source = touch.utmSource.toLowerCase();
    const medium = touch.utmMedium.toLowerCase();
    let origin = touch.utmSource || "Directo / Orgánico";

    if (touch.gclid || (source === "google" && medium === "cpc")) {
      origin = "Google Ads";
    } else if (
      touch.fbclid ||
      source.includes("meta") ||
      source.includes("facebook") ||
      source.includes("instagram")
    ) {
      origin = "Meta Ads";
    }

    return { ...touch, origin };
  }

  /**
   * Prepara el estado para la página actual:
   * - incrementa el contador de páginas cargadas;
   * - guarda la primera URL visitada si todavía no existe;
   * - actualiza el último origen/campaña cuando esta URL trae identificadores;
   * - persiste el resultado para utilizarlo en un clic posterior o en otra
   *   página del sitio.
   *
   * Los parámetros de campaña se conservan en localStorage cuando se navega
   * a páginas internas que ya no los incluyen en su URL.
   */
  function getPageStateForThisVisit() {
    const state = getPageState();
    state.visits += 1;
    if (!state.entryPage) state.entryPage = window.location.href;

    const currentTouch = getTouchFromUrl();
    if (currentTouch) state.lastTouch = currentTouch;

    writeStorage(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  /**
   * Devuelve el valor de una cookie del documento o una cadena vacía si no
   * está presente. Se usa para leer _fbp, identificador del navegador que
   * puede ayudar con la atribución de Meta cuando está disponible.
   */
  function getCookie(name) {
    const prefix = `${name}=`;
    const cookie = document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(prefix));
    return cookie ? cookie.slice(prefix.length) : "";
  }

  /**
   * Determina si el enlace apunta a un contacto que queremos registrar.
   *
   * Reconoce enlaces mailto: como email y enlaces HTTPS de wa.me,
   * whatsapp.com o sus subdominios como WhatsApp. Los demás enlaces no se
   * consideran contactos. Si la URL no puede analizarse, devuelve null.
   */
  function getContactType(anchor) {
    let url;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch (error) {
      console.warn("No se pudo interpretar el enlace de contacto.", error);
      return null;
    }

    if (url.protocol === "mailto:") return "email";
    if (
      url.protocol === "https:" &&
      (url.hostname === "wa.me" ||
        url.hostname === "whatsapp.com" ||
        url.hostname.endsWith(".whatsapp.com"))
    ) {
      return "whatsapp";
    }

    return null;
  }

  /**
   * Construye el objeto que se enviará a Apps Script.
   *
   * Incluye el tipo de contacto, el último origen/campaña persistido,
   * identificadores Google/Meta disponibles, cantidad de páginas vistas,
   * primera página visitada y URL donde ocurrió el clic. Algunos campos de
   * grupo de anuncios/conjunto/anuncio se dejan vacíos porque el navegador
   * no puede deducirlos de forma fiable si no vienen en parámetros propios.
   */
  function buildPayload(state, contactType, ticketId) {
    const touch = state.lastTouch || {
      gclid: "",
      fbclid: "",
      utmCampaign: "",
      utmMedium: "",
      utmSource: "",
      utmTerm: "",
      utmContent: "",
      origin: "Directo / Orgánico",
    };
    const campaign =
      touch.utmCampaign ||
      (touch.gclid ? "Google_Ads_Gclid" : "") ||
      (touch.fbclid ? "Meta_Ads_Fbclid" : "Sin Campaña");

    return {
      ticket_id: ticketId,
      tipo_contacto: contactType,
      origen_ultimo_clic: touch.origin,
      campaña_principal: campaign,
      gclid: touch.gclid,
      google_campaign:
        touch.utmMedium.toLowerCase() === "cpc" && touch.origin === "Google Ads"
          ? touch.utmCampaign
          : "",
      google_adgroup: "",
      google_keyword: touch.utmTerm,
      fbclid: touch.fbclid,
      fbp: getCookie("_fbp"),
      meta_campaign: touch.origin === "Meta Ads" ? touch.utmCampaign : "",
      meta_adset_ad: "",
      utm_source: touch.utmSource,
      utm_medium: touch.utmMedium,
      utm_content: touch.utmContent,
      visitas_sitio: state.visits,
      pagina_entrada: state.entryPage,
      pagina_conversion: window.location.href,
    };
  }

  /**
   * Emite eventos de contacto a los sistemas de analítica disponibles y
   * envía el payload a Apps Script sin bloquear la navegación.
   *
   * - dataLayer: publica contact_conversion para que GTM pueda reaccionar.
   * - Meta Pixel: publica el evento estándar Contact si fbq está instalado.
   * - Apps Script: hace POST con JSON serializado como texto plano para evitar
   *   la preflight CORS habitual de application/json.
   *
   * mode: "no-cors" evita que CORS impida iniciar la solicitud desde el sitio,
   * pero la respuesta será opaca y no se puede confirmar su procesamiento.
   * keepalive solicita que el navegador intente completar el POST aunque la
   * página se cierre inmediatamente después del clic.
   */
  function trackContact(contactType, anchor, payload) {
    // Evento personalizado que puede activarse como disparador en GTM.
    const eventData = {
      event: "contact_conversion",
      contact_type: contactType,
      contact_url: anchor.href,
      page_location: window.location.href,
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);

    // Envía el evento estándar Contact solamente cuando el Meta Pixel ya está
    // cargado; el registro en Apps Script no depende de la presencia del Pixel.
    if (typeof window.fbq === "function") {
      window.fbq("track", "Contact", {
        content_name: window.location.pathname,
        contact_method: contactType,
      });
    }

    // Inicia el POST en segundo plano. No se espera la respuesta, para que el
    // enlace de WhatsApp/email conserve su navegación inmediata.
    const body = JSON.stringify(payload);
    fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
      keepalive: true,
    }).catch((error) => {
      // Solo se puede informar de errores locales de red; no se puede leer una
      // respuesta de Apps Script porque la solicitud está en modo no-cors.
      console.error(
        "No se pudo registrar la atribución en Apps Script.",
        error,
      );
    });
  }

  // Actualiza el estado una vez por carga de este archivo/página.
  const pageState = getPageStateForThisVisit();

  // Escucha en fase de captura para detectar el clic aunque ocurra en un icono
  // o texto anidado dentro del enlace. La delegación también cubre enlaces que
  // se agreguen dinámicamente después de cargar este script.
  document.addEventListener(
    "click",
    function (event) {
      // No intervenir si otro código ya canceló el evento, si no es el clic
      // principal del mouse o si el usuario usa modificadores para abrir/copiar
      // el enlace de forma alternativa.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      // El clic puede caer en un SVG, una imagen o un span dentro del enlace.
      // closest() busca el <a href> ancestro más cercano.
      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest("a[href]") : null;
      if (!anchor) return;

      // Ignorar enlaces ajenos a WhatsApp y correo electrónico.
      const contactType = getContactType(anchor);
      if (!contactType) return;

      try {
        const ticketId = generarTicketID();

        // Si es un enlace de WhatsApp, inyecta el ticket en el texto del mensaje
        if (contactType === "whatsapp") {
          const urlObj = new URL(anchor.href);
          let textParam = urlObj.searchParams.get("text") || "";
          const sufijo = ` Nº de consulta: ${ticketId}`;
          if (!textParam.includes(ticketId)) {
            urlObj.searchParams.set(
              "text",
              textParam ? `${textParam} ${sufijo}` : sufijo,
            );
            anchor.href = urlObj.toString();
          }
        }

        // Si es un enlace de correo (mailto:), inyecta el ticket en el asunto (subject)
        if (contactType === "email") {
          const urlObj = new URL(anchor.href);
          let subjectParam = urlObj.searchParams.get("subject") || "";
          const sufijo = `Nº de consulta: ${ticketId}`;
          if (!subjectParam.includes(ticketId)) {
            const nuevoAsunto = subjectParam
              ? `${subjectParam} - ${sufijo}`
              : sufijo;
            // Forzamos el uso de %20 en lugar de + para que Thunderbird lo interprete bien
            urlObj.searchParams.set("subject", nuevoAsunto);
            anchor.href = urlObj.toString().replace(/\+/g, "%20");
          }
        }

        // Registrar el intento de contacto con el ID generado en el cliente.
        const payload = buildPayload(pageState, contactType, ticketId);
        trackContact(contactType, anchor, payload);
      } catch (error) {
        // Un fallo al preparar/emitir el tracking no debe impedir que el
        // navegador abra WhatsApp o el cliente de correo.
        console.error("No se pudo preparar el registro de atribución.", error);
      }
    },
    // true = fase de captura: recibir el clic antes de que llegue al enlace.
    true,
  );
})();
