/* ============================================
   CARGA DE EVENTOS DEL MENÚ
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    setupMenuListeners();
});

/* ============================================
   FUNCIONES HELPER - Acceso rápido a elementos
   ============================================ */
// Devuelve el elemento del menú principal (lista de navegación)
const navMenu = () => document.getElementById('nav-menu');

// Devuelve el ícono del hamburger (menú móvil)
const hamburger = () => document.querySelector('.hamburger');

// Devuelve el overlay oscuro que aparece detrás del menú en móvil
const overlay = () => document.querySelector('.mobile-overlay');

// Devuelve el contenedor del dropdown de "Capacitaciones"
const dropdownCap = () => document.getElementById('dropdown-cap');
const dropdownMenu = () => dropdownCap()?.querySelector('.dropdown-menu');

/* ============================================
   FUNCIONES AUXILIARES DEL SUBMENÚ
   ============================================ */

// Abre el submenú de "Capacitaciones" en móvil.
// Usa animación de altura para que el desplegable crezca desde 0 hasta el contenido.
function openDropdown() {
    const menu = dropdownMenu();
    const dropdown = dropdownCap();
    if (!menu || !dropdown) return;

    dropdown.classList.add('open');
    menu.style.height = '0px';
    menu.style.visibility = 'visible';
    menu.style.opacity = '1';

    // requestAnimationFrame garantiza que el navegador aplique el height 0
    // antes de iniciar la transición al tamaño real del contenido.
    requestAnimationFrame(() => {
        menu.style.height = `${menu.scrollHeight}px`;
    });
}

// Cierra el submenú de "Capacitaciones" en móvil.
// Se anima de la altura actual hacia 0 para el colapso suave.
function closeDropdown() {
    const menu = dropdownMenu();
    const dropdown = dropdownCap();
    if (!menu || !dropdown) return;

    // Establecer la altura actual permite una transición suave hacia 0.
    menu.style.height = `${menu.scrollHeight}px`;
    requestAnimationFrame(() => {
        menu.style.height = '0px';
    });
    dropdown.classList.remove('open');
}

// Gestiona el final de la transición de height.
// - Si quedó abierto: fija height:auto para que el contenido pueda crecer naturalmente.
// - Si quedó cerrado: oculta el submenú y restaura la opacidad.
function handleTransitionEnd(e) {
    if (e.propertyName !== 'height') return;
    const menu = dropdownMenu();
    const dropdown = dropdownCap();
    if (!menu || !dropdown) return;

    if (dropdown.classList.contains('open')) {
        menu.style.height = 'auto';
    } else {
        menu.style.visibility = 'hidden';
        menu.style.opacity = '0';
    }
}

/* ============================================
   FUNCIONES PRINCIPALES DEL MENÚ
   ============================================ */

// Abre/Cierra el menú hamburguesa principal
// Alterna las clases 'active' en: menú, hamburger e overlay
// Si cerramos el menú, también cierra el dropdown de Capacitaciones
function toggleMenu() {
    const isActive = navMenu().classList.toggle('active');
    hamburger().classList.toggle('active');
    overlay().classList.toggle('active');
    
    // Si cerramos el menú, también cerramos el submenú
    if (!isActive) {
        closeDropdown();
    }
}

// Cierra completamente el menú y todos sus submenús
// Se ejecuta cuando: hace clic en overlay, en un link, o se redimensiona la ventana
function closeMenu() {
    navMenu().classList.remove('active');
    hamburger().classList.remove('active');
    overlay().classList.remove('active');
    closeDropdown();
}

// Maneja el clic en "Capacitaciones" en dispositivos móviles (≤768px)
// Abre/cierra el dropdown sin cerrar el menú principal
// preventDefault y stopPropagation evitan que se cierren otros elementos
function handleMobileClick(e) {
    if (window.innerWidth <= 768) {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = dropdownCap();
        if (!dropdown) return;

        if (dropdown.classList.contains('open')) {
            closeDropdown();
        } else {
            openDropdown();
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
    document.querySelectorAll('#nav-menu a').forEach(link => {
        link.addEventListener('click', function() {
            // Si es el link que abre el dropdown, NO hacer nada
            // (dejar que handleMobileClick() lo maneje)
            if (this.classList.contains('dropdown-toggle')) return;
            
            // Si es cualquier otro link (normal o del dropdown) en móvil, cierra todo
            if (window.innerWidth <= 768) {
                closeMenu();
            }
        });
    });

    const menu = dropdownMenu();
    if (menu) {
        menu.addEventListener('transitionend', handleTransitionEnd);
    }
}