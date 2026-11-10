(function () {
  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbzJpD52mws24tAyjoCjzkZl8WBJ6h7YLBpAoWo2DbBDklRgXUN0lC3fouYtgZ3ZbzEiOw/exec";
  const STORAGE_KEY = "edsi_contact_attribution";
  const SAVE_TIMEOUT_MS = 2000;
  const pendingLinks = new WeakSet();

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn("No se pudo leer el almacenamiento local de atribución.", error);
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("No se pudo guardar la atribución en este navegador.", error);
    }
  }

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
        console.warn("Estado de atribución inválido; se reinicia el seguimiento.");
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        console.warn("Estado de atribución inválido; se reinicia el seguimiento.");
      }
    }

    return {
      entryPage: "",
      visits: 0,
      lastTouch: null,
    };
  }

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

  function getPageStateForThisVisit() {
    const state = getPageState();
    state.visits += 1;
    if (!state.entryPage) state.entryPage = window.location.href;

    const currentTouch = getTouchFromUrl();
    if (currentTouch) state.lastTouch = currentTouch;

    writeStorage(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function getCookie(name) {
    const prefix = `${name}=`;
    const cookie = document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(prefix));
    return cookie ? cookie.slice(prefix.length) : "";
  }

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

  function buildPayload(state, contactType) {
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
      tipo_contacto: contactType,
      origen_ultimo_clic: touch.origin,
      campaña_principal: campaign,
      gclid: touch.gclid,
      google_campaign:
        touch.utmMedium.toLowerCase() === "cpc" &&
        touch.origin === "Google Ads"
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

  function trackContact(contactType, anchor, payload) {
    const eventData = {
      event: "contact_conversion",
      contact_type: contactType,
      contact_url: anchor.href,
      page_location: window.location.href,
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);

    if (typeof window.fbq === "function") {
      window.fbq("track", "Contact", {
        content_name: window.location.pathname,
        contact_method: contactType,
      });
    }

    let timeoutId;
    const timeout = new Promise((resolve) => {
      timeoutId = window.setTimeout(resolve, SAVE_TIMEOUT_MS);
    });
    const saveRequest = fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch((error) => {
      console.error("No se pudo registrar la atribución en Apps Script.", error);
    });

    return Promise.race([saveRequest, timeout]).finally(() =>
      window.clearTimeout(timeoutId),
    );
  }

  function navigateToContact(anchor) {
    const target = anchor.getAttribute("target");
    const opensNewTab = target && target.toLowerCase() === "_blank";
    const pendingWindow = opensNewTab
      ? window.open("about:blank", "_blank")
      : null;

    if (pendingWindow) pendingWindow.opener = null;

    return function () {
      if (pendingWindow && !pendingWindow.closed) {
        pendingWindow.location.replace(anchor.href);
      } else {
        window.location.assign(anchor.href);
      }
    };
  }

  const pageState = getPageStateForThisVisit();

  document.addEventListener(
    "click",
    function (event) {
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

      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest("a[href]") : null;
      if (!anchor) return;

      const contactType = getContactType(anchor);
      if (!contactType) return;

      event.preventDefault();
      if (pendingLinks.has(anchor)) return;
      pendingLinks.add(anchor);

      const navigate = navigateToContact(anchor);
      const payload = buildPayload(pageState, contactType);
      trackContact(contactType, anchor, payload).finally(navigate);
    },
    true,
  );
})();
