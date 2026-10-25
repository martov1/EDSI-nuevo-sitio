---
---

/*********************************************************************
 * CONFIGURACIÓN DE CUPOS DEL CURSO
 *
 * Los valores propios del curso se leen desde _config.yml y Jekyll los
 * inserta al generar este archivo JavaScript.
 *********************************************************************/
const CUPOS_CONFIG = {
  spreadsheetId: {{ site.brigadista.cupos.spreadsheet_id | jsonify }},
  capacidadMaxima: {{ site.brigadista.cupos.capacidad_maxima }},
  inscripcionesAbiertas: {{ site.brigadista.cupos.inscripciones_abiertas | jsonify }},
  mostrarCupoLleno: {{ site.brigadista.cupos["mostrar-cupo-lleno"] | jsonify }},
};

// La página del curso muestra las vacantes una vez obtenido el estado.
document.addEventListener("DOMContentLoaded", function () {
  const cuposEl = document.getElementById("cupos-disponibles");

  if (cuposEl && !CUPOS_CONFIG.mostrarCupoLleno) {
    obtenerEstadoCupos(CUPOS_CONFIG).then(({ cuposDisponibles }) => {
      cuposEl.textContent = CUPOS_CONFIG.inscripcionesAbiertas
        ? `${cuposDisponibles} vacantes disponibles`
        : `Hasta ${CUPOS_CONFIG.capacidadMaxima} participantes.`;
    });
  }
});


/**
 * ------------------------------------------------------------------------
 * Eventos de META PIXEL
 * ------------------------------------------------------------------------
 */

/**
 * 
 * Evento EngagedReader 
 * 
 * Dispara una vez por usuario cuando:
 * el usuario hace scroll más del 50% de la página o llega al final, o bien 
 * recorre la página más de 10 segundos y hace scroll.
 */

(function() {
  // Evita disparar más de una vez por usuario
  if (localStorage.getItem('engaged_reader_fired')) return;

  let hasScrolled = false;
  let fired = false;

  function fireEngagedReader() {
    if (fired) return;
    fired = true;
    localStorage.setItem('engaged_reader_fired', '1');
    
    // Dispara evento personalizado al Pixel
    fbq('trackCustom', 'EngagedReader', {
      content_name: window.location.pathname
    });
    console.log('Evento EngagedReader disparado');
  }

  // 1. Detecta si hizo scroll
  window.addEventListener('scroll', function() {
    hasScrolled = true;
    // Calcula % de scroll
    let scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
    
    // Condición A: scrolleó más del 50% o llegó al final
    if (scrollPercent > 50) {
      fireEngagedReader();
    }
  }, {passive: true});

  // 2. Condición B: más de 10 segundos + hizo scroll
  setTimeout(function() {
    if (hasScrolled) {
      fireEngagedReader();
    }
  }, 10000);
})();