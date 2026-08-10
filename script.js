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
