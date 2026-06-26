/* ============================================
   CARGA DE EVENTOS DEL MENÚ
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    setupMenuListeners();
});

/* ============================================
   FUNCIONES HELPER - Acceso rápido a elementos
   ============================================ */
// Retorna el elemento del menú principal (lista de navegación)
const navMenu = () => document.getElementById('nav-menu');

// Retorna el ícono del hamburger (menú móvil)
const hamburger = () => document.querySelector('.hamburger');

// Retorna el overlay oscuro que aparece detrás del menú en móvil
const overlay = () => document.querySelector('.mobile-overlay');

// Retorna el contenedor del dropdown de "Capacitaciones"
const dropdownCap = () => document.getElementById('dropdown-cap');
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
        dropdownCap().classList.remove('open');
    }
}

// Cierra completamente el menú y todos sus submenús
// Se ejecuta cuando: hace clic en overlay, en un link, o se redimensiona la ventana
function closeMenu() {
    navMenu().classList.remove('active');
    hamburger().classList.remove('active');
    overlay().classList.remove('active');
    dropdownCap().classList.remove('open');
}

// Maneja el clic en "Capacitaciones" en dispositivos móviles (≤768px)
// Abre/cierra el dropdown sin cerrar el menú principal
// preventDefault y stopPropagation evitan que se cierren otros elementos
function handleMobileClick(e) {
    if (window.innerWidth <= 768) {
        e.preventDefault();
        e.stopPropagation();
        dropdownCap().classList.toggle('open');
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
}