// examenes.js — Editor integrado de evaluación y examen por curso

function normalizarEvaluacionAdmin(valor) {
  return valor && Array.isArray(valor.preguntas)
    ? { minimaAprobatoria: Number(valor.minimaAprobatoria ?? 70), preguntas: valor.preguntas }
    : { minimaAprobatoria: 70, preguntas: [] };
}

async function administrarExamen(idCurso, opciones = {}) {
  if (guardandoCursoAdmin) return;
  const volverAContenido = modalContenidoCurso && !modalContenidoCurso.hidden;
  const origen = document.activeElement;
  cerrarContenidoCurso();
  const curso = listaCursos.find((c) => String(c.id) === String(idCurso));
  const tipo = opciones.tipo === "evaluacion" ? "evaluacion" : "examen";
  let actual = normalizarEvaluacionAdmin(opciones.evaluacion);
  if (idCurso && !opciones.evaluacion) {
    actual = normalizarEvaluacionAdmin(await evaluaciones.obtenerPorCursoTipo(idCurso, tipo));
  }

  const etiqueta = tipo === "evaluacion" ? "Evaluación del curso" : "Examen final";
  const descripcion = tipo === "evaluacion"
    ? "Crea preguntas para comprobar el aprendizaje durante el recorrido del curso."
    : "Crea las preguntas finales que determinarán si el trabajador aprueba el curso.";

  const modal = document.createElement("div");
  modal.className = "admin-examen-backdrop";
  modal.style.zIndex = "2147483647";
  modal.innerHTML = `
    <section class="admin-examen-card" role="dialog" aria-modal="true" aria-labelledby="titulo-editor-examen">
      <header class="admin-examen-cabecera">
        <div><span class="admin-bloque-kicker">${etiqueta}</span><h3 id="titulo-editor-examen">${escaparHtml(curso?.nombre || opciones.nombre || "Nuevo curso")}</h3><p class="muted">${descripcion}</p></div>
        <button type="button" class="admin-examen-cerrar" aria-label="Cerrar">×</button>
      </header>
      <form id="form-editor-examen">
        <div class="admin-examen-resumen">
          <label>Calificación mínima aprobatoria
            <input type="number" name="minima" min="0" max="100" value="${actual.minimaAprobatoria}" required>
          </label>
          <span><strong id="contador-preguntas">${actual.preguntas.length}</strong> preguntas configuradas</span>
        </div>
        <div class="admin-examen-preguntas" id="editor-preguntas"></div>
        <button type="button" class="btn btn-secundario btn-sm" id="btn-nueva-pregunta">+ Agregar pregunta</button>
        <footer class="admin-examen-acciones">
          <button type="button" class="btn btn-secundario" data-cerrar-examen>Cancelar</button>
          <button type="submit" class="btn btn-primario">Guardar ${tipo}</button>
        </footer>
      </form>
    </section>`;

  const preguntas = modal.querySelector("#editor-preguntas");
  let indice = 0;
  const agregarPregunta = (pregunta = {}) => {
    const opcionesPregunta = pregunta.opciones || [];
    const id = pregunta.id || Date.now() + indice;
    const bloque = document.createElement("div");
    bloque.className = "admin-examen-pregunta";
    bloque.dataset.id = String(id);
    bloque.innerHTML = `
      <div class="admin-examen-pregunta-titulo"><strong>Pregunta ${indice + 1}</strong><button type="button" class="admin-examen-quitar">Quitar</button></div>
      <input class="examen-enunciado" type="text" placeholder="Escribe el enunciado de la pregunta" value="${escaparHtml(pregunta.enunciado || "")}" required>
      <div class="admin-examen-opciones">
        ${["a", "b", "c", "d"].map((letra, i) => `<label>Opción ${letra.toUpperCase()}<input class="examen-opcion" data-opcion="${letra}" type="text" value="${escaparHtml(opcionesPregunta[i]?.texto || "")}" ${i < 3 ? "required" : ""}></label>`).join("")}
      </div>
      <label class="examen-correcta">Respuesta correcta
        <select class="examen-correcta-select">
          ${["a", "b", "c", "d"].map((letra, i) => `<option value="${letra}" ${!opcionesPregunta[i]?.texto && letra === "d" ? "disabled" : ""}>Opción ${letra.toUpperCase()}</option>`).join("")}
        </select>
      </label>`;
    const correcta = bloque.querySelector(".examen-correcta-select");
    correcta.value = pregunta.correcta || "a";
    bloque.querySelector('[data-opcion="d"]').addEventListener("input", (evento) => {
      const vacia = !evento.target.value.trim();
      correcta.querySelector('option[value="d"]').disabled = vacia;
      if (vacia && correcta.value === "d") correcta.value = "a";
    });
    bloque.querySelector(".admin-examen-quitar").addEventListener("click", () => { bloque.remove(); actualizarContador(); renumerarPreguntas(); });
    preguntas.appendChild(bloque);
    indice += 1;
  };
  const actualizarContador = () => { modal.querySelector("#contador-preguntas").textContent = preguntas.children.length; };
  const renumerarPreguntas = () => [...preguntas.children].forEach((b, i) => b.querySelector("strong").textContent = `Pregunta ${i + 1}`);
  actual.preguntas.forEach(agregarPregunta);
  modal.querySelector("#btn-nueva-pregunta").addEventListener("click", () => { agregarPregunta(); actualizarContador(); });
  let guardando = false;
  const teclado = (evento) => {
    if (evento.key === "Escape") { evento.preventDefault(); cerrar(); }
  };
  const cerrar = () => {
    if (guardando) return;
    document.removeEventListener("keydown", teclado);
    modal.remove();
    if (volverAContenido) abrirContenidoCurso();
    else document.body.classList.remove("admin-modal-abierto");
    if (origen?.isConnected) origen.focus();
  };
  document.addEventListener("keydown", teclado);
  modal.querySelectorAll("[data-cerrar-examen], .admin-examen-cerrar").forEach((btn) => btn.addEventListener("click", cerrar));
  modal.querySelector("#form-editor-examen").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const minimaAprobatoria = Number(new FormData(evento.target).get("minima"));
    const nuevasPreguntas = [...preguntas.children].map((bloque, i) => ({
      id: Number(bloque.dataset.id) || i + 1,
      enunciado: bloque.querySelector(".examen-enunciado").value.trim(),
      opciones: ["a", "b", "c", "d"].map((letra) => ({ id: letra, texto: bloque.querySelector(`[data-opcion="${letra}"]`).value.trim() })).filter((o) => o.texto),
      correcta: bloque.querySelector(".examen-correcta-select").value,
    }));
    if (!nuevasPreguntas.length) { mostrarToastAdmin("Agrega al menos una pregunta.", "error"); return; }
    const datos = { minimaAprobatoria, preguntas: nuevasPreguntas };
    if (nuevasPreguntas.some(p => !p.enunciado || !p.opciones.some(o => o.id === p.correcta))) {
      mostrarToastAdmin("Completa cada pregunta y selecciona una respuesta correcta con texto.", "error"); return;
    }
    const botonGuardar = evento.target.querySelector('[type="submit"]');
    await ejecutarAccionAdmin(botonGuardar, async () => {
    guardando = true;
    try {
    if (idCurso) await evaluaciones.actualizarTipo(idCurso, tipo, datos);
    if (tipo === "evaluacion") {
      evaluacionPendiente = datos;
    } else {
      examenPendiente = datos;
    }
    document.getElementById(tipo === "evaluacion" ? "btn-agregar-evaluacion-estructura" : "btn-agregar-examen-estructura").textContent = `Editar ${tipo}`;
    guardando = false;
    cerrar();
    mostrarToastAdmin(`${etiqueta} configurada con ${nuevasPreguntas.length} pregunta(s).`, "exito");
    } finally { guardando = false; }
    });
  });
  document.body.classList.add("admin-modal-abierto");
  document.body.appendChild(modal);
  modal.querySelector(".admin-examen-cerrar").focus();
}

// Se conserva este nombre para que el arranque del panel siga siendo compatible.
async function pintarExamenes() { return true; }
