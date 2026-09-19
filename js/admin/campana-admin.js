// campana-admin.js — Centro rápido de alertas del administrador

function construirAlertasAdmin() {
  const solicitudesPendientes = listaSolicitudes.filter((s) => s.estado === "pendiente");
  const alertasPassword = solicitudesPendientes.map((s) => {
    const usuario = listaUsuarios.find((u) => u.id === s.usuarioId);
    return { tipo: "password", fecha: s.fecha, usuario, solicitud: s };
  });
  const alertasCursos = listaNotificaciones
    .filter((n) => n.tipo === "curso-completado" || n.tipo === "curso-listo")
    .map((n) => ({ tipo: n.tipo, fecha: n.fecha, usuario: n.usuario, curso: n.curso, notificacion: n }));
  return [...alertasPassword, ...alertasCursos]
    .filter((a) => a.usuario)
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
}

function pintarCampanaAdmin() {
  const boton = document.getElementById("btn-campana-admin");
  const badge = document.getElementById("campana-admin-badge");
  const lista = document.getElementById("campana-admin-lista");
  const resumen = document.getElementById("campana-admin-resumen");
  if (!boton || !badge || !lista || !resumen) return;
  const alertas = construirAlertasAdmin();
  const cantidad = alertas.length;
  badge.textContent = cantidad > 99 ? "99+" : String(cantidad);
  badge.style.display = cantidad ? "inline-flex" : "none";
  resumen.textContent = cantidad ? `${cantidad} alerta${cantidad === 1 ? "" : "s"} pendiente${cantidad === 1 ? "" : "s"}` : "Sin novedades pendientes";
  lista.innerHTML = alertas.length ? alertas.slice(0, 8).map((a) => {
    const nombre = escaparHtml(a.usuario.nombre);
    if (a.tipo === "password") {
      return `<article class="admin-campana-item campana-password"><div class="admin-campana-icono">🔐</div><div class="admin-campana-texto"><strong>${nombre} pidió restablecer su contraseña</strong><small>${formatoFecha(a.fecha)}</small><button type="button" class="btn btn-primario btn-sm" data-campana-password="${a.usuario.id}">Editar contraseña</button></div></article>`;
    }
    return `<article class="admin-campana-item campana-curso"><div class="admin-campana-icono">🎓</div><div class="admin-campana-texto"><strong>${nombre} terminó ${escaparHtml(a.curso?.nombre || "un curso")}</strong><small>${formatoFecha(a.fecha)}</small><button type="button" class="btn btn-secundario btn-sm" data-campana-curso>Ver notificaciones</button></div></article>`;
  }).join("") : '<div class="admin-campana-vacia">✓ No hay solicitudes ni cursos terminados pendientes de revisar.</div>';
}

function abrirCampanaAdmin() {
  const panel = document.getElementById("panel-campana-admin");
  const boton = document.getElementById("btn-campana-admin");
  if (!panel || !boton) return;
  const abierto = !panel.hidden;
  panel.hidden = abierto;
  boton.setAttribute("aria-expanded", String(!abierto));
}

function irASolicitudPassword(idUsuario) {
  const panel = document.getElementById("panel-campana-admin");
  const boton = document.getElementById("btn-campana-admin");
  if (panel) panel.hidden = true;
  boton?.setAttribute("aria-expanded", "false");
  const seccion = document.getElementById("solicitudes-admin");
  seccion?.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => {
    const buscador = document.getElementById("buscar-solicitudes");
    const usuario = listaUsuarios.find((u) => Number(u.id) === Number(idUsuario));
    if (buscador && usuario) { buscador.value = usuario.nombre; pintarSolicitudes(); }
    setTimeout(() => {
      const input = document.querySelector(`[data-nueva-password="${idUsuario}"]`);
      input?.focus();
    }, 80);
  }, 250);
}

document.getElementById("btn-campana-admin")?.addEventListener("click", (e) => { e.stopPropagation(); abrirCampanaAdmin(); });
document.getElementById("panel-campana-admin")?.addEventListener("click", (e) => {
  const password = e.target.closest("[data-campana-password]");
  if (password) { e.stopPropagation(); irASolicitudPassword(password.dataset.campanaPassword); return; }
  const cursos = e.target.closest("[data-campana-curso]");
  if (cursos) {
    const panel = document.getElementById("panel-campana-admin");
    if (panel) panel.hidden = true;
    document.getElementById("notificaciones-admin")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
document.getElementById("btn-ver-notificaciones")?.addEventListener("click", () => {
  const panel = document.getElementById("panel-campana-admin");
  if (panel) panel.hidden = true;
  document.getElementById("notificaciones-admin")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.addEventListener("click", (e) => {
  const wrap = document.querySelector(".admin-campana-wrap");
  const panel = document.getElementById("panel-campana-admin");
  const boton = document.getElementById("btn-campana-admin");
  if (wrap && panel && boton && !wrap.contains(e.target)) { panel.hidden = true; boton.setAttribute("aria-expanded", "false"); }
});

// El panel administrativo consulta alertas periódicamente para detectar nuevas solicitudes
// y cursos terminados mientras el administrador mantiene la página abierta.
setInterval(async () => {
  if (!sesion.activa() || sesion.rol() !== "admin" || cargaDashboardEnCurso) return;
  try {
    const [solicitudes, notificaciones] = await Promise.all([solicitudesReset.listar(), notificacionesAdmin.listar()]);
    listaSolicitudes = solicitudes;
    listaNotificaciones = notificaciones;
    pintarNotificaciones();
    pintarCampanaAdmin();
  } catch (error) { /* el panel seguirá funcionando con los últimos datos */ }
}, 15000);
