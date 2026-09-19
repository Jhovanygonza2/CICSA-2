// notificaciones.js — Notificaciones del panel administrativo

function pintarNotificaciones() {
  const lista = document.getElementById("lista-notificaciones-admin");
  const badge = document.getElementById("notificaciones-admin-badge");
  if (!lista || !badge) return;
  const pendientes = listaNotificaciones.filter((n) => !n.leida);
  badge.textContent = pendientes.length;
  badge.style.display = pendientes.length ? "inline-flex" : "none";
  lista.innerHTML = listaNotificaciones.length
    ? listaNotificaciones.map((n) => {
      const nombre = n.usuario?.nombre || "Un trabajador";
      const texto = n.tipo === "password"
        ? `${nombre} solicitó restablecer su contraseña.`
        : n.tipo === "curso-completado"
          ? `${nombre} terminó y aprobó el curso «${n.curso?.nombre || "Curso"}».`
          : `${nombre} terminó el contenido del curso «${n.curso?.nombre || "Curso"}» y ya puede presentar su evaluación.`;
      return `<li class="${n.leida ? "" : "notificacion-admin-nueva"}"><div class="notificacion-admin-contenido"><strong>${escaparHtml(texto)}</strong><small>${formatoFecha(n.fecha)}</small></div><button type="button" class="btn btn-texto btn-sm notificacion-admin-eliminar" data-eliminar-notificacion="${escaparHtml(n.id)}" aria-label="Eliminar notificación">Eliminar</button></li>`;
    }).join("")
    : "<li class=\"muted\">No hay notificaciones.</li>";
  lista.querySelectorAll("[data-eliminar-notificacion]").forEach((boton) => {
    boton.addEventListener("click", async () => {
     boton.disabled = true;
     try {
       await notificacionesAdmin.eliminar(boton.dataset.eliminarNotificacion);
       listaNotificaciones = listaNotificaciones.filter((notificacion) => String(notificacion.id) !== boton.dataset.eliminarNotificacion);
       pintarNotificaciones();
       pintarCampanaAdmin();
     } catch (error) {
       boton.disabled = false;
       mostrarToastAdmin(error.message || "No se pudo eliminar la notificación.", "error");
     }
    });
  });
}

document.getElementById("btn-eliminar-notificaciones")?.addEventListener("click", async () => {
  if (!listaNotificaciones.length) return;
  const confirmar = window.confirm("¿Eliminar todas las notificaciones?");
  if (!confirmar) return;
  const boton = document.getElementById("btn-eliminar-notificaciones");
  boton.disabled = true;
  try {
    await notificacionesAdmin.eliminarTodas();
    listaNotificaciones = [];
    pintarNotificaciones();
    pintarCampanaAdmin();
  } catch (error) {
    mostrarToastAdmin(error.message || "No se pudieron eliminar las notificaciones.", "error");
  } finally {
    boton.disabled = false;
  }
});
