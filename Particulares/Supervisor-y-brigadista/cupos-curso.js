/*********************************************************************
 * CUPOS DEL CURSO
 *
 * Este archivo se reutiliza en distintas páginas para mostrar cuántos
 * cupos quedan disponibles según la planilla pública del curso.
 *********************************************************************/

/*********************************************************************
 * CONFIGURACIÓN
 *
 * Acá se define el ID de la planilla y la capacidad máxima del curso.
 * Si cambias de curso, solo tenés que ajustar estos valores.
 *********************************************************************/
const CUPOS_CONFIG = {
  spreadsheetId: "1rIE5dT2raFRLX7lyB_Qi-8IOVoq0cvr4slU7fDrJREs",
  capacidadMaxima: 15,
};

/*********************************************************************
 * FUNCION PRINCIPAL: obtenerEstadoCupos
 *
 * Qué devuelve:
 * - un objeto con este formato:
 *   {
 *     confirmados: 12,
 *     cuposDisponibles: 3,
 *     totalInscriptos: 15
 *   }
 *
 * Flujo:
 * 1) toma el ID de la planilla y arma la URL pública de Google Sheets
 * 2) hace fetch a esa URL
 * 3) convierte la respuesta gviz en un array de objetos
 * 4) cuenta cuántos registros tienen "Reserva confirmada" en "si" o "sí"
 * 5) resta esa cantidad a la capacidad máxima
 * 6) devuelve ese objeto y, si se pasa un elemento del DOM,
 *    actualiza ese texto con la cantidad disponible
 *********************************************************************/
async function obtenerEstadoCupos({
  // ID público de la planilla de Google Sheets.
  spreadsheetId = CUPOS_CONFIG.spreadsheetId,
  // Cantidad máxima de personas que puede haber en el curso.
  capacidadMaxima = CUPOS_CONFIG.capacidadMaxima,
  // Nombre de la columna que indica si la reserva está confirmada.
  nombreColumna = "Reserva confirmada",
  // Elemento del DOM donde se va a mostrar el texto final.
  elementoDestino = null,
  // Función opcional para formatear el mensaje final.
  formatearTexto = null,
} = {}) {
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
    const cuposDisponibles = Math.max(0, capacidadMaxima - confirmados);

    // 9) Armamos el resultado final que se devuelve a quien llame la función.
    const resultado = {
      confirmados,
      cuposDisponibles,
      totalInscriptos: inscriptos.length,
    };

    // Log útil para depurar en consola mientras carga la página.
    console.log("Cupos del curso:", resultado);

    // 10) Si nos pasaron un elemento del DOM, actualizamos el texto visible.
    if (elementoDestino) {
      const texto =
        typeof formatearTexto === "function"
          ? formatearTexto(resultado)
          : `${cuposDisponibles} cupos disponibles`;

      elementoDestino.textContent = texto;
    }

    return resultado;
  } catch (error) {
    // En caso de error, mostramos en consola y devolvemos un estado conservador.
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
          : `hasta ${capacidadMaxima} participantes`;
    }

    return resultadoFallback;
  }
}
