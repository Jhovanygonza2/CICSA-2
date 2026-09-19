# CICSA Capacita — Frontend

Frontend completo (HTML + CSS + JavaScript sin frameworks) para la plataforma
de capacitación de empleados. Construido desde cero con un sistema de diseño
propio, listo para conectarse al backend Node/Express/MySQL descrito en el
proyecto.

## Cómo verlo

No necesitas instalar nada. Basta con abrir `index.html` en el navegador,
o servirlo con un servidor estático simple:

```bash
cd frontend
python3 -m http.server 5500
# abre http://localhost:5500
```

> Si lo abres con doble clic (`file://...`) todo funciona igual, porque no
> depende de rutas absolutas ni de un backend corriendo: viene en **modo
> demo** con datos simulados (ver siguiente sección).

## Modo demo vs. backend real

Todo el tráfico de red pasa por `js/api.js`. Ahí mismo hay dos variables al
principio del archivo:

```js
const API_BASE = "http://localhost:4000/api"; // pon la URL real de tu API
const MOCK_MODE = true; // cámbialo a false cuando el backend esté listo
```

Mientras `MOCK_MODE` sea `true`, el frontend funciona por completo con datos
en memoria (usuarios, cursos, progreso, evaluaciones) para que puedas
mostrarlo o probarlo sin depender del backend. Cuando tu API de Express esté
corriendo, cambia `MOCK_MODE` a `false` y ajusta `API_BASE`: las funciones
públicas (`auth`, `usuarios`, `cursos`, `progreso`, `lecciones`,
`evaluaciones`, `reportes`) ya están escritas para llamar a los endpoints
reales con `fetch` y el token JWT en el header `Authorization`.

**Usuarios de prueba (modo demo):**
| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `ana.torres@cicsa.mx` | `Admin2026` |
| Trabajador | `jhovany@cicsa.mx` | `Cicsa2026` |

## Estructura

```
frontend/
├── index.html                 Login
├── recuperar.html              Recuperar / restablecer contraseña
├── admin/
│   └── dashboard.html          Panel admin: Usuarios · Cursos · Seguimiento (barra superior)
├── trabajador/
│   ├── dashboard.html          Mis cursos (tarjetas con menú de tres puntos)
│   ├── perfil.html             Perfil: banner + Insignias y certificados + Historia de aprendizaje
│   └── curso.html               Visor de curso (tema oscuro): esquema colapsable + lección + evaluación
├── css/
│   └── styles.css              Sistema de diseño (tokens, componentes, tema oscuro del visor)
└── js/
    ├── api.js                  Cliente de API + sesión + datos de demo
    ├── login.js
    ├── recuperar.js
    ├── menu-perfil.js          Controla el panel de perfil deslizable (drawer), compartido
    ├── admin-dashboard.js
    ├── worker-dashboard.js
    ├── perfil.js
    └── curso.js
```

## Endpoints que espera el backend

`js/api.js` ya está escrito contra este contrato; solo hace falta que el
backend Express los implemente con esas mismas rutas y formas de respuesta
(o edita las funciones en `api.js` si tus rutas ya tienen otros nombres):

| Método | Ruta | Uso |
|---|---|---|
| POST | `/auth/login` | `{correo, password}` → `{token, usuario}` |
| POST | `/auth/olvide-password` | `{correo}` |
| POST | `/auth/restablecer-password` | `{token, password}` |
| GET | `/usuarios` | listar (admin) |
| POST | `/usuarios` | crear |
| PATCH | `/usuarios/:id/estado` | `{activo}` activar/desactivar |
| GET | `/cursos` | listar |
| GET | `/cursos/:id` | detalle con módulos y lecciones |
| POST | `/cursos` | crear |
| PATCH | `/cursos/:id/estado` | `{estado}` publicar/despublicar |
| GET | `/progreso/mis-cursos` | cursos asignados + avance del usuario en sesión |
| POST | `/progreso/leccion/:id/completar` | marcar lección vista |
| GET | `/lecciones/:id` | contenido de una lección |
| GET | `/evaluaciones/curso/:id` | preguntas y calificación mínima |
| POST | `/evaluaciones/curso/:id/intento` | `{respuestas}` → `{nota, aprobado}` |
| GET | `/reportes/seguimiento` | resultados para el panel de seguimiento |

Todas las llamadas envían `Authorization: Bearer <token>` automáticamente
una vez que el usuario inicia sesión (`sesion.token()` en `api.js`).

## Trazabilidad con los requerimientos

| Requerimientos | Dónde vive en el frontend |
|---|---|
| RF-001, RF-005, RF-006 | `admin/dashboard.html` → vista Usuarios, `admin-dashboard.js` |
| RF-002, RF-003 | `index.html`, `login.js` (redirección según rol) |
| RF-004 | `recuperar.html`, `recuperar.js` |
| RF-007, RF-008, RS-007..011 | `sesion.requerir()` en `api.js`, usado al inicio de cada página protegida |
| RF-009..016 | `admin/dashboard.html` → vista Cursos |
| RF-017..022 | `trabajador/lector.html` (render de lección según `tipo`) |
| RF-023..029 | `trabajador/dashboard.html`, `lector.js` |
| RF-030..036 | `lector.js` → `mostrarEvaluacion()` / `mostrarResultadoEvaluacion()` |
| RF-039..044 | `admin/dashboard.html` → vista Seguimiento (filtros + exportar CSV) |
| RS-001, RS-005, RS-006 | `sesion.*` en `api.js` (token, cuenta inactiva, cierre por inactividad) |
| Responsivo | `media queries` al final de `css/styles.css` |

## Siguientes pasos sugeridos

- Conectar `MOCK_MODE = false` contra tu backend Express real.
- Agregar formularios de administración de contenido (subir video/documento)
  dentro de la vista Cursos, una vez que el backend tenga endpoints de carga
  de archivos.
- Conectar un servicio SMTP para enviar al administrador las solicitudes de
  `/auth/olvide-password`; en modo demo se registran en las notificaciones
  administrativas y se dirigen a `ana.torres@cicsa.mx`.
