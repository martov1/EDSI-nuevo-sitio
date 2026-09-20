/*********************************************************************
 * CUPOS DEL CURSO
 *
 * Este archivo se reutiliza en distintas páginas para mostrar cuántos
 * cupos quedan disponibles según la planilla pública del curso.
 *********************************************************************/
async function obtenerEstadoCupos({
  spreadsheetId = "TU_SPREADSHEET_ID_AQUI",
  capacidadMaxima = 20,
  nombreColumna = "Reserva confirmada",
  elementoDestino = null,
  formatearTexto = null,
} = {}) {
  const jsonUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;

  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const jsonText = text
      .replace(/^\/\*.*\*\/\s*google\.visualization\.Query\.setResponse\(/, "")
      .replace(/\);\s*$/, "");

    const gvizObj = JSON.parse(jsonText);
    const cols = (gvizObj.table.cols || []).map((col) =>
      col && col.label ? col.label.trim() : "",
    );
    const rows = gvizObj.table.rows || [];

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

    const confirmados = inscriptos.filter((item) => {
      const estado = String(item[nombreColumna] || "")
        .trim()
        .toLowerCase();
      return estado === "si" || estado === "sí";
    }).length;

    const cuposDisponibles = Math.max(0, capacidadMaxima - confirmados);
    const resultado = {
      confirmados,
      cuposDisponibles,
      totalInscriptos: inscriptos.length,
    };

    if (elementoDestino) {
      const texto =
        typeof formatearTexto === "function"
          ? formatearTexto(resultado)
          : `${cuposDisponibles} cupos disponibles`;

      elementoDestino.textContent = texto;
    }

    return resultado;
  } catch (error) {
    console.error("Error al obtener los datos de la planilla:", error);

    const resultadoFallback = {
      confirmados: 0,
      cuposDisponibles: capacidadMaxima,
      totalInscriptos: 0,
    };

    if (elementoDestino) {
      elementoDestino.textContent =
        typeof formatearTexto === "function"
          ? formatearTexto(resultadoFallback)
          : `${capacidadMaxima} cupos disponibles`;
    }

    return resultadoFallback;
  }
}
