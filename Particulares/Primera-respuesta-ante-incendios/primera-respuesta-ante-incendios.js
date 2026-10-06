---
---

const CUPOS_CONFIG = {
  spreadsheetId: {{ site.primera_respuesta_incendios.cupos.spreadsheet_id | jsonify }},
  capacidadMaxima: {{ site.primera_respuesta_incendios.cupos.capacidad_maxima }},
  inscripcionesAbiertas: {{ site.primera_respuesta_incendios.cupos.inscripciones_abiertas | jsonify }},
  mostrarCupoLleno: {{ site.primera_respuesta_incendios.cupos["mostrar-cupo-lleno"] | jsonify }},
};

document.addEventListener("DOMContentLoaded", function () {
  const cuposEl = document.getElementById("cupos-disponibles");

  if (cuposEl && !CUPOS_CONFIG.mostrarCupoLleno) {
    obtenerEstadoCupos(CUPOS_CONFIG).then(({ cuposDisponibles }) => {
      cuposEl.textContent = CUPOS_CONFIG.inscripcionesAbiertas
        ? `${cuposDisponibles} vacantes disponibles`
        : "Inscripciones próximamente";
    });
  }
});
