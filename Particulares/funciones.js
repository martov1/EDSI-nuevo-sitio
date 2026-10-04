/*********************************************************************
 * FUNCIONES REUTILIZABLES PARA CURSOS PARTICULARES
 *********************************************************************/

/*********************************************************************
 * Devuelve true si la pantalla está en orientación vertical.
 *********************************************************************/
function isPortraitOrientation() {
  return window.matchMedia("(orientation: portrait)").matches;
}

/*********************************************************************
 * Desplaza suavemente la página hasta un elemento.
 *
 * portraitOnly limita el desplazamiento a pantallas en orientación vertical.
 *********************************************************************/
function scrollToElement(element, block = "center", portraitOnly = true) {
  if (portraitOnly && !isPortraitOrientation()) {
    return;
  }

  requestAnimationFrame(function () {
    element.scrollIntoView({ behavior: "smooth", block });
  });
}

/*********************************************************************
 * FUNCION: obtenerEstadoCupos
 *
 * Recibe la configuración de un curso y devuelve:
 * {
 *   confirmados: 12,
 *   cuposDisponibles: 3,
 *   totalInscriptos: 15
 * }
 *********************************************************************/
async function obtenerEstadoCupos({
  // ID público de la planilla de Google Sheets.
  spreadsheetId,
  // Cantidad máxima de personas que puede haber en el curso.
  capacidadMaxima,
  // Define si se debe consultar la planilla o mostrar el fallback.
  inscripcionesAbiertas,
  // Nombre de la columna que indica si la reserva está confirmada.
  nombreColumna = "Reserva confirmada",
} = {}) {
  // Si las inscripciones están cerradas, devolvemos el estado sin consultar la planilla.
  if (!inscripcionesAbiertas) {
    return {
      confirmados: 0,
      cuposDisponibles: capacidadMaxima,
      totalInscriptos: 0,
    };
  }

  // URL pública para consultar la planilla en formato JSON.
  const jsonUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;

  try {
    // 1) Pedimos los datos a la planilla pública.
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // 2) Leemos la respuesta como texto, porque Google devuelve un formato especial.
    const text = await response.text();

    // 3) Quitamos el prefijo y el cierre que Google agrega a la respuesta gviz.
    const jsonText = text
      .replace(/^\/\*.*\*\/\s*google\.visualization\.Query\.setResponse\(/, "")
      .replace(/\);\s*$/, "");

    // 4) Parseamos el JSON a un objeto JavaScript.
    const gvizObj = JSON.parse(jsonText);

    // 5) Tomamos los nombres de las columnas para luego mapear cada fila.
    const cols = (gvizObj.table.cols || []).map((col) =>
      col && col.label ? col.label.trim() : "",
    );
    const rows = gvizObj.table.rows || [];

    // 6) Convertimos cada fila en un objeto estilo {
    //    "Nombre": "Juan",
    //    "Reserva confirmada": "si"
    //    }
    const inscriptos = rows.map((row) => {
      const obj = {};

      (row.c || []).forEach((cell, index) => {
        const colName = cols[index];
        if (!colName) return;

        if (!cell) {
          obj[colName] = "";
        } else if (cell.f !== undefined) {
          obj[colName] = cell.f;
        } else {
          obj[colName] = cell.v;
        }
      });

      return obj;
    });

    // 7) Contamos cuántas reservas están confirmadas.
    const confirmados = inscriptos.filter((item) => {
      const estado = String(item[nombreColumna] || "")
        .trim()
        .toLowerCase();
      return estado === "si" || estado === "sí";
    }).length;

    // 8) Calculamos cuántos cupos quedan.
    const cuposDisponibles = Math.max(1, capacidadMaxima - confirmados);

    // 9) Armamos el resultado final que se devuelve a quien llame la función.
    const resultado = {
      confirmados,
      cuposDisponibles,
      totalInscriptos: inscriptos.length,
    };

    // Log útil para depurar en consola mientras carga la página.
    console.log("Cupos del curso:", resultado);

    return resultado;
  } catch (error) {
    // En caso de error, mostramos en consola y devolvemos un estado conservador.
    console.error("Error al obtener los datos de la planilla:", error);

    return {
      confirmados: 0,
      cuposDisponibles: capacidadMaxima,
      totalInscriptos: 0,
    };
  }
}
