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
