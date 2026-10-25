/* ============================================
   CARGA DE EVENTOS DEL MENÚ
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  setupMenuListeners();
});

/* ============================================
   FUNCIONES HELPER - Acceso rápido a elementos
   ============================================ */
// Devuelve el elemento del menú principal (lista de navegación)
const navMenu = () => document.getElementById("nav-menu");

// Devuelve el ícono del hamburger (menú móvil)
const hamburger = () => document.querySelector(".hamburger");

// Devuelve el overlay oscuro que aparece detrás del menú en móvil
const overlay = () => document.querySelector(".mobile-overlay");

// Devuelve todos los contenedores dropdown del menú
const dropdowns = () => document.querySelectorAll("#nav-menu .dropdown");
const dropdownMenu = (dropdown) => dropdown?.querySelector(".dropdown-menu");

/* ============================================
   FUNCIONES AUXILIARES DEL SUBMENÚ
   ============================================ */

// Abre el submenú del dropdown recibido en móvil.
function openDropdown(dropdown) {
  const menu = dropdownMenu(dropdown);
  if (!menu || !dropdown) return;

  dropdown.classList.add("open");
  menu.style.height = "0px";
  menu.style.visibility = "visible";
  menu.style.opacity = "1";

  requestAnimationFrame(() => {
    menu.style.height = `${menu.scrollHeight}px`;
  });
}

// Cierra el submenú del dropdown recibido en móvil.
function closeDropdown(dropdown) {
  const menu = dropdownMenu(dropdown);
  if (!menu || !dropdown) return;

  menu.style.height = `${menu.scrollHeight}px`;
  requestAnimationFrame(() => {
    menu.style.height = "0px";
  });
  dropdown.classList.remove("open");
}

// Cierra todos los dropdowns abiertos en el menú móvil.
function closeAllDropdowns() {
  dropdowns().forEach((dropdown) => {
    if (dropdown.classList.contains("open")) {
      closeDropdown(dropdown);
    }
  });
}

// Gestiona el final de la transición de height.
function handleTransitionEnd(e) {
  if (e.propertyName !== "height") return;
  const menu = e.currentTarget;
  const dropdown = menu.closest(".dropdown");
  if (!menu || !dropdown) return;

  if (dropdown.classList.contains("open")) {
    menu.style.height = "auto";
  } else {
    menu.style.visibility = "hidden";
    menu.style.opacity = "0";
  }
}

/* ============================================
   FUNCIONES PRINCIPALES DEL MENÚ
   ============================================ */

// Abre/Cierra el menú hamburguesa principal
// Alterna las clases 'active' en: menú, hamburger e overlay
// Si cerramos el menú, también cierra el dropdown de Capacitaciones
function toggleMenu() {
  const isActive = navMenu().classList.toggle("active");
  hamburger().classList.toggle("active");
  overlay().classList.toggle("active");

  // Si cerramos el menú, también cerramos los submenús
  if (!isActive) {
    closeAllDropdowns();
  }
}

// Cierra completamente el menú y todos sus submenús
// Se ejecuta cuando: hace clic en overlay, en un link, o se redimensiona la ventana
function closeMenu() {
  navMenu().classList.remove("active");
  hamburger().classList.remove("active");
  overlay().classList.remove("active");
  closeAllDropdowns();
}

// Maneja el clic en un dropdown en dispositivos móviles (≤768px)
// Abre/cierra el dropdown correcto sin cerrar el menú principal
function handleMobileClick(e) {
  if (window.innerWidth <= 768) {
    e.preventDefault();
    e.stopPropagation();
    const dropdown = e.currentTarget.closest(".dropdown");
    if (!dropdown) return;

    if (dropdown.classList.contains("open")) {
      closeDropdown(dropdown);
    } else {
      closeAllDropdowns();
      openDropdown(dropdown);
    }
  }
}

/* ============================================
   SETUP DE EVENT LISTENERS
   ============================================ */

// Se ejecuta después de que el header carga dinámicamente
// Asigna eventos a todos los links de navegación
function setupMenuListeners() {
  // Para cada link del menú, asigna un listener de clic
  document.querySelectorAll("#nav-menu a").forEach((link) => {
    link.addEventListener("click", function () {
      if (this.classList.contains("dropdown-toggle")) return;

      if (window.innerWidth <= 768) {
        closeMenu();
      }
    });
  });

  document.querySelectorAll("#nav-menu .dropdown-menu").forEach((menu) => {
    menu.addEventListener("transitionend", handleTransitionEnd);
  });
}

/**
 * ------------------------------------------------------------------------
 * Eventos de META PIXEL
 * ------------------------------------------------------------------------
 */

/**
 *
 * Evento EngagedReader
 *
 * Dispara una vez por usuario al acumular 10 segundos activos y alcanzar
 * al menos el 50% de profundidad dentro de una ventana de una hora.
 */

(function () {
  // Requisitos del evento y clave para compartir el seguimiento entre páginas.
  const activeTimeRequired = 10000;
  const trackingWindow = 60 * 60 * 1000;
  const stateKey = "engaged_reader_state";

  // Si ya se disparó, no vuelve a enviarse en este navegador.
  if (localStorage.getItem("engaged_reader_fired")) return;

  // Estado persistente: inicio de la ventana, tiempo activo y profundidad alcanzada.
  function createState(startedAt = Date.now()) {
    return {
      startedAt,
      activeTime: 0,
      hasReachedScrollDepth: false,
    };
  }

  // Recupera el progreso entre páginas si todavía está dentro de la hora.
  function loadState() {
    const savedState = localStorage.getItem(stateKey);
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (
          Number.isFinite(parsedState.startedAt) &&
          Number.isFinite(parsedState.activeTime) &&
          typeof parsedState.hasReachedScrollDepth === "boolean" &&
          Date.now() >= parsedState.startedAt &&
          Date.now() - parsedState.startedAt < trackingWindow
        ) {
          return parsedState;
        }
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        console.warn("Estado de EngagedReader inválido; se reinicia el seguimiento.");
      }
    }
    return createState();
  }

  // activeSince marca el inicio del tramo activo de esta página.
  let state = loadState();
  let activeSince = null;
  let timer = null;
  let fired = false;

  // Persiste el acumulado y el avance para continuar en otra página.
  function saveState() {
    localStorage.setItem(stateKey, JSON.stringify(state));
  }

  // Considera activa la página solo si está visible y tiene el foco.
  function isPageActive() {
    return (
      document.visibilityState === "visible" &&
      document.hasFocus()
    );
  }

  // Al vencer la hora, comienza una ventana nueva y descarta el progreso previo.
  function resetExpiredWindow() {
    const now = Date.now();
    if (now - state.startedAt < trackingWindow) return;

    state = createState(now);
    activeSince = isPageActive() ? now : null;
    saveState();
  }

  // Suma el tramo activo actual antes de pausar o salir de la página.
  function pauseActiveTime() {
    if (activeSince !== null) {
      state.activeTime += Date.now() - activeSince;
      activeSince = null;
    }
    clearTimeout(timer);
    timer = null;
    saveState();
  }

  // Envía el evento solo si se cumplieron el tiempo y la profundidad requeridos.
  function fireEngagedReader() {
    resetExpiredWindow();
    if (
      fired ||
      !state.hasReachedScrollDepth ||
      !isPageActive() ||
      state.activeTime + (activeSince === null ? 0 : Date.now() - activeSince) <
        activeTimeRequired
    ) {
      return;
    }

    // Si el Pixel todavía no está listo, vuelve a intentar en un segundo.
    if (typeof window.fbq !== "function") {
      timer = setTimeout(fireEngagedReader, 1000);
      return;
    }

    window.fbq("trackCustom", "EngagedReader", {
      content_name: window.location.pathname,
    });
    localStorage.setItem("engaged_reader_fired", "1");
    localStorage.removeItem(stateKey);
    fired = true;
    console.log("Evento EngagedReader disparado");
  }

  // Inicia, pausa o programa el contador según el estado visible y el foco.
  function updateActiveTime() {
    if (fired) return;
    resetExpiredWindow();

    if (!isPageActive()) {
      pauseActiveTime();
      return;
    }

    if (activeSince === null) {
      activeSince = Date.now();
    }

    // Incluye el tramo activo actual sin esperar a que se pause.
    const remaining =
      activeTimeRequired - state.activeTime - (Date.now() - activeSince);

    if (remaining <= 0) {
      fireEngagedReader();
    } else {
      clearTimeout(timer);
      timer = setTimeout(updateActiveTime, remaining);
    }
  }

  // Guarda el requisito de profundidad al alcanzar el 50% de la página.
  window.addEventListener(
    "scroll",
    function () {
      resetExpiredWindow();
      const scrollPercent =
        ((window.scrollY + window.innerHeight) /
          document.documentElement.scrollHeight) *
        100;
      if (scrollPercent >= 50 && !state.hasReachedScrollDepth) {
        state.hasReachedScrollDepth = true;
        saveState();
      }
      fireEngagedReader();
      updateActiveTime();
    },
    { passive: true },
  );

  // Actualiza o pausa el contador al cambiar visibilidad, foco o página.
  document.addEventListener("visibilitychange", updateActiveTime);
  window.addEventListener("focus", updateActiveTime);
  window.addEventListener("blur", pauseActiveTime);
  window.addEventListener("pagehide", pauseActiveTime);
  window.addEventListener("pageshow", updateActiveTime);

  // Comienza a contar inmediatamente si la página ya está activa.
  updateActiveTime();
})();
