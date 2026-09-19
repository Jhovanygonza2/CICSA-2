// worker-dashboard.js — Dashboard del trabajador con cursos asignados

sesion.requerir(["trabajador"]);
sesion.vigilarInactividad(20);

const trabajadorActual = sesion.usuario();
const bienvenidaTrabajador = document.getElementById("bienvenida-trabajador");
if (bienvenidaTrabajador && trabajadorActual?.nombre) {
  bienvenidaTrabajador.textContent = `Bienvenido, ${trabajadorActual.nombre.split(" ")[0]}`;
}

let itemsCursos = [];
let cursosVisibles = [];
let notificacionesMostradas = false;
const claveNotificaciones = `cicsa_notificaciones_descartadas_${trabajadorActual?.id || "anonimo"}`;
let notificacionesEliminadas = new Set();
try {
  const guardadas = JSON.parse(localStorage.getItem(claveNotificaciones) || "[]");
  if (Array.isArray(guardadas)) notificacionesEliminadas = new Set(guardadas.map(String));
} catch (error) { console.warn("No se pudieron leer las notificaciones descartadas.", error); }
let focoAntesNotificaciones = null;

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function tiempoRestanteCurso(curso){const id=trabajadorActual?.id||"anonimo";const fin=Number(localStorage.getItem(`cicsa_temporizador_${id}_${curso.id}`)||0);if(!fin)return "⏱ No iniciado";const seg=Math.max(0,Math.floor((fin-Date.now())/1000));return `⏱ ${String(Math.floor(seg/3600)).padStart(2,"0")}:${String(Math.floor(seg%3600/60)).padStart(2,"0")}:${String(seg%60).padStart(2,"0")} restantes`;}

function formatoProgramacion(iso) { return iso ? new Date(iso).toLocaleString("es-MX", {dateStyle:"short",timeStyle:"short"}) : ""; }

function obtenerThumbnailSegura(url) {
  const fallback = "../assets/soldador.avif";
  if (!url) return fallback;
  try {
    const valor = new URL(url, window.location.href);
    const esRutaRelativa = !/^[a-z][a-z0-9+.-]*:/i.test(String(url));
    return esRutaRelativa || ["http:", "https:"].includes(valor.protocol)
      ? escaparHtml(esRutaRelativa ? String(url) : valor.href)
      : fallback;
  } catch (error) {
    return fallback;
  }
}

async function cargarMisCursos() {
  const rejilla = document.getElementById("rejilla-cursos-trabajador");
  if (rejilla) {
    rejilla.classList.add("is-loading");
    rejilla.setAttribute("aria-busy", "true");
    rejilla.innerHTML = Array.from({ length: 3 }, () => `
      <article class="skeleton-card" aria-hidden="true">
        <div class="skeleton skeleton-thumbnail"></div>
        <div class="skeleton skeleton-line skeleton-line-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line skeleton-line-short"></div>
      </article>
    `).join("");
  }
  try {
    itemsCursos = await progreso.misCursos();
    cursosVisibles = itemsCursos;
    actualizarEstadisticas(itemsCursos);
    actualizarPanelLateral(itemsCursos);
    actualizarNotificaciones(itemsCursos);
    pintarCursos(itemsCursos);
  } catch (error) {
    if (rejilla) {
      rejilla.textContent = error.message || "No se pudieron cargar tus cursos.";
      rejilla.classList.add("estado-error");
    }
  } finally {
    rejilla?.classList.remove("is-loading");
    rejilla?.setAttribute("aria-busy", "false");
  }
}

function pintarCursos(items) {
  const rejilla = document.getElementById("rejilla-cursos-trabajador");
  if (!rejilla) return;
  rejilla.innerHTML = items.length
    ? items.map(({ curso, progreso: p }) => { const temporal=estadoTemporalCurso(curso); const bloqueado=temporal!=="abierto"; const etiqueta=temporal==="programado"?`Abre ${formatoProgramacion(curso.fechaInicio)}`:temporal==="cerrado"?"Curso cerrado":(p.estado === "no_iniciado" ? "Comenzar" : "Continuar"); return `
      <${bloqueado ? "article" : "a"} class="tarjeta-curso" ${bloqueado ? 'aria-disabled="true"' : `href="lector.html?id=${encodeURIComponent(curso.id)}" aria-label="Abrir curso: ${escaparHtml(curso.nombre)}"`}>
        <div class="tarjeta-curso-thumbnail">
          <img loading="lazy" decoding="async" src="${obtenerThumbnailSegura(curso.thumbnail)}" alt="${escaparHtml(curso.nombre)}" />
        </div>
        <div class="tarjeta-curso-contenido">
          <div class="tarjeta-curso-titulo">${escaparHtml(curso.nombre)}</div>
          <div class="tarjeta-curso-meta"><span>${escaparHtml(curso.categoria || "General")}</span><span class="tiempo-card">${tiempoRestanteCurso(curso)}</span></div>
          <p class="muted">${escaparHtml(curso.descripcion || "")}</p>
          <div class="tarjeta-curso-progreso">
            <span>${p.porcentaje}%</span>
            <div class="progreso-barra"><div class="progreso-relleno" style="width:${p.porcentaje}%"></div></div>
          </div>
          ${curso.fechaInicio || curso.fechaFin ? `<div class="tarjeta-curso-horario"><small>📅 ${curso.fechaInicio ? `Abre: ${formatoProgramacion(curso.fechaInicio)}` : "Disponible al publicar"}</small><small>🔒 ${curso.fechaFin ? `Cierra: ${formatoProgramacion(curso.fechaFin)}` : "Sin fecha de cierre"}</small></div>` : ""}
          ${bloqueado ? `<p class="curso-disponibilidad">${escaparHtml(etiqueta)}</p>` : ""}
        </div>
      </${bloqueado ? "article" : "a"}>
    `; }).join("")
    : '<p class="muted">Aún no tienes cursos asignados.</p>';

  rejilla.querySelectorAll(".tarjeta-curso-thumbnail img").forEach((imagen) => {
    imagen.addEventListener("error", () => {
      if (imagen.dataset.fallbackAplicado === "true") return;
      imagen.dataset.fallbackAplicado = "true";
      imagen.src = "../assets/soldador.avif";
    });
  });
}

function filtrarCursos() {
  const consulta = document.getElementById("buscar-curso")?.value.trim().toLowerCase() || "";
  const academia = document.getElementById("filtro-academia")?.value || "";
  const tipo = document.getElementById("filtro-tipo")?.value || "";
  cursosVisibles = itemsCursos.filter(({ curso }) => {
    const texto = [curso.nombre, curso.descripcion, curso.categoria, curso.academia].join(" ").toLowerCase();
    return (!consulta || texto.includes(consulta))
      && (!academia || curso.academia === academia)
      && (!tipo || curso.tipo === tipo);
  });
  pintarCursos(cursosVisibles);
}

function actualizarPanelLateral(items) {
  const logros = document.getElementById("logros-container");
  const tareas = document.getElementById("tareas-container");
  if (!logros || !tareas) return;
  const completados = items.filter(({ progreso }) => progreso.estado === "completado");
  logros.innerHTML = completados.length
    ? completados.slice(0, 3).map(({ curso }) => `
      <div class="logro-item"><span class="logro-icono">✓</span><div><strong>${escaparHtml(curso.nombre)}</strong><small>Curso completado</small></div></div>
    `).join("")
    : '<div class="panel-vacio">No hay logros todavía</div>';
  const pendientes = items.filter(({ progreso }) => progreso.estado !== "completado");
  tareas.innerHTML = pendientes.length
    ? pendientes.slice(0, 3).map(({ curso, progreso }) => `
      <div class="tarea-item"><strong>${progreso.estado === "no_iniciado" ? "Comenzar curso" : "Continuar curso"}</strong><span>${escaparHtml(curso.nombre)}</span></div>
    `).join("")
    : '<div class="panel-vacio">No tienes tareas pendientes</div>';
}

function obtenerNotificacionesTrabajador(items, ahora = new Date()) {
  const avisos = [];
  items.forEach(({curso, progreso: avance}) => {
    if (avance?.estado === "completado") {
      avisos.push({id: String(curso.id), tipo: "completado", icono: "✓", etiqueta: "Curso completado", nombre: curso.nombre, mensaje: "Terminaste este curso. Consulta tu logro en tu perfil."});
    } else if (curso.fechaInicio && ahora < new Date(curso.fechaInicio)) {
      avisos.push({id: `inicio-${curso.id}-${curso.fechaInicio}`, tipo: "programado", icono: "◷", etiqueta: "Próxima apertura", nombre: curso.nombre, mensaje: `Disponible a partir del ${formatoProgramacion(curso.fechaInicio)}.`});
    } else if (curso.fechaInicio && ahora >= new Date(curso.fechaInicio) && (!curso.fechaFin || ahora <= new Date(curso.fechaFin))) {
      avisos.push({id: `abierto-${curso.id}-${curso.fechaInicio}`, tipo: "abierto", icono: "→", etiqueta: "Ya disponible", nombre: curso.nombre, mensaje: curso.fechaFin ? `Puedes comenzar. Cierra el ${formatoProgramacion(curso.fechaFin)}.` : "El curso está abierto. Puedes comenzar cuando quieras."});
    }
  });
  return avisos.filter(aviso => !notificacionesEliminadas.has(aviso.id));
}

function actualizarNotificaciones(items) {
  const btn = document.getElementById("btn-notificaciones");
  const badge = document.getElementById("notificaciones-badge");
  if (!btn || !badge) return;
  const avisos = obtenerNotificacionesTrabajador(items);
  btn.style.display = "inline-flex";
  btn.title = avisos.length ? `Tienes ${avisos.length} notificaciones` : "Sin notificaciones";
  btn.setAttribute("aria-label", btn.title);
  badge.textContent = avisos.length;
  badge.style.display = avisos.length ? "flex" : "none";
  const completado = avisos.find(aviso => aviso.tipo === "completado");
  if (completado && !notificacionesMostradas) {
    mostrarToast("¡Curso completado!", completado.nombre);
    notificacionesMostradas = true;
  }
}

function descartarNotificaciones(ids) {
  const siguientes = new Set([...notificacionesEliminadas, ...ids.map(String)]);
  try {
    localStorage.setItem(claveNotificaciones, JSON.stringify([...siguientes]));
  } catch (error) {
    document.getElementById("notificaciones-error").textContent = "No se pudo guardar el cambio. Intenta quitar la notificación de nuevo.";
    return;
  }
  notificacionesEliminadas = siguientes;
  document.getElementById("notificaciones-error").textContent = "";
  actualizarNotificaciones(itemsCursos);
  pintarNotificacionesTrabajador();
  document.getElementById("notificaciones-estado").textContent = ids.length === 1 ? "Notificación eliminada." : "Notificaciones eliminadas.";
  const siguiente = document.querySelector("#lista-notificaciones .btn-quitar-notificacion");
  (siguiente || document.querySelector(".modal-notificaciones-close"))?.focus();
}

function pintarNotificacionesTrabajador() {
  const lista = document.getElementById("lista-notificaciones");
  const avisos = obtenerNotificacionesTrabajador(itemsCursos);
  document.getElementById("notificaciones-resumen").textContent = avisos.length ? `${avisos.length} aviso${avisos.length === 1 ? " pendiente" : "s pendientes"}` : "Todo al día";
  document.getElementById("btn-quitar-todas-notificaciones").hidden = !avisos.length;
  lista.innerHTML = avisos.length ? avisos.map(aviso => `
    <article class="item-notificacion notificacion-${aviso.tipo}">
      <div class="item-notificacion-icono" aria-hidden="true">${aviso.icono}</div>
      <div class="item-notificacion-texto"><small class="notificacion-etiqueta">${aviso.etiqueta}</small><strong>${escaparHtml(aviso.nombre)}</strong><span>${escaparHtml(aviso.mensaje)}</span></div>
      <button type="button" class="btn-quitar-notificacion" data-notificacion-id="${escaparHtml(aviso.id)}" aria-label="Quitar notificación: ${escaparHtml(aviso.nombre)}">Quitar</button>
    </article>`).join("") : '<div class="notificaciones-vacias"><span aria-hidden="true">✓</span><strong>Estás al día</strong><p>Aquí verás las novedades de tus cursos.</p></div>';
}

function abrirModalNotificaciones() {
  const modal = document.getElementById("modal-notificaciones");
  if (!modal) return;
  focoAntesNotificaciones = document.activeElement;
  pintarNotificacionesTrabajador();
  modal.classList.remove("oculto");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("notificaciones-abiertas");
  document.getElementById("btn-notificaciones")?.setAttribute("aria-expanded", "true");
  modal.querySelector(".modal-notificaciones-close")?.focus();
}

function cerrarModalNotificaciones() {
  const modal = document.getElementById("modal-notificaciones");
  if (!modal) return;
  modal.classList.add("oculto");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("notificaciones-abiertas");
  document.getElementById("btn-notificaciones")?.setAttribute("aria-expanded", "false");
  if (focoAntesNotificaciones?.isConnected) focoAntesNotificaciones.focus();
}

function mostrarToast(mensaje, cursoNombre = "Curso") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  const icono = document.createElement("span");
  icono.className = "toast-icono";
  icono.textContent = "✓";
  const contenido = document.createElement("div");
  contenido.style.flex = "1";
  const titulo = document.createElement("strong");
  titulo.textContent = mensaje;
  const curso = document.createElement("div");
  curso.textContent = cursoNombre;
  curso.style.cssText = "font-size: 12px; opacity: 0.9; margin-top: 4px;";
  contenido.append(titulo, curso);
  const cerrar = document.createElement("button");
  cerrar.className = "btn btn-texto toast-close";
  cerrar.type = "button";
  cerrar.setAttribute("aria-label", "Cerrar notificación");
  cerrar.textContent = "✕";
  cerrar.style.cssText = "color: white; padding: 0 4px; min-width: auto;";
  toast.append(icono, contenido, cerrar);
  cerrar.addEventListener("click", () => toast.remove());

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2800);
}

function actualizarEstadisticas(items) {
  const completados = items.filter((i) => i.progreso.estado === "completado").length;
  const enProceso = items.filter((i) => i.progreso.estado === "en_proceso").length;
  const noIniciados = items.filter((i) => i.progreso.estado === "no_iniciado").length;

  document.getElementById("stat-completados").textContent = completados;
  document.getElementById("stat-progreso").textContent = enProceso;
  document.getElementById("stat-noIniciados").textContent = noIniciados;
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  const btnNotificaciones = document.getElementById("btn-notificaciones");
  const modalNotificaciones = document.getElementById("modal-notificaciones");
  const btnCerrarNotificaciones = document.querySelector(".modal-notificaciones-close");

  document.getElementById("lista-notificaciones")?.addEventListener("click", (event) => {
    const boton = event.target.closest("[data-notificacion-id]");
    if (boton) descartarNotificaciones([boton.dataset.notificacionId]);
  });
  document.getElementById("btn-quitar-todas-notificaciones")?.addEventListener("click", () => {
    descartarNotificaciones(obtenerNotificacionesTrabajador(itemsCursos).map(aviso => aviso.id));
  });
  if (btnNotificaciones) {
    btnNotificaciones.addEventListener("click", abrirModalNotificaciones);
  }

  if (btnCerrarNotificaciones) {
    btnCerrarNotificaciones.addEventListener("click", cerrarModalNotificaciones);
  }

  ["buscar-curso", "filtro-academia", "filtro-tipo"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", filtrarCursos);
    document.getElementById(id)?.addEventListener("change", filtrarCursos);
  });

  const rejillaCursos = document.getElementById("rejilla-cursos-trabajador");
  document.getElementById("vista-grilla")?.addEventListener("click", () => {
    rejillaCursos?.classList.remove("vista-lista");
    document.getElementById("vista-grilla")?.classList.add("activo");
    document.getElementById("vista-lista")?.classList.remove("activo");
  });
  document.getElementById("vista-lista")?.addEventListener("click", () => {
    rejillaCursos?.classList.add("vista-lista");
    document.getElementById("vista-lista")?.classList.add("activo");
    document.getElementById("vista-grilla")?.classList.remove("activo");
  });

  document.querySelector(".help-btn")?.addEventListener("click", () => {
    window.alert("Usa el buscador para encontrar cursos y haz clic en la tarjeta del curso para entrar.");
  });


  if (modalNotificaciones) {
    modalNotificaciones.addEventListener("click", (event) => {
      if (event.target === modalNotificaciones) {
        cerrarModalNotificaciones();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && modalNotificaciones && !modalNotificaciones.classList.contains("oculto")) {
      const controles = [...modalNotificaciones.querySelectorAll("button")].filter(b => !b.hidden && !b.disabled && b.getClientRects().length);
      const primero = controles[0], ultimo = controles[controles.length - 1];
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo?.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero?.focus(); }
    }
    if (event.key === "Escape" && modalNotificaciones && !modalNotificaciones.classList.contains("oculto")) {
      cerrarModalNotificaciones();
    }
  });

  // Cargar cursos
  cargarMisCursos();
});
