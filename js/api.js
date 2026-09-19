/**
 * api.js — Cliente de API para CICSA Capacita
 * ---------------------------------------------------------------
 * Centraliza toda comunicación con el backend (Node/Express/MySQL).
 * Cambia MOCK_MODE a false cuando el backend esté corriendo, y
 * ajusta API_BASE a la URL real (ej. http://localhost:4000/api).
 *
 * Cobertura de requerimientos (trazabilidad):
 *  RF-001..005  auth.* / users.*
 *  RF-006..008  sesion.rol() controla qué botones/rutas se muestran
 *  RF-009..016  cursos.*
 *  RF-017..022  contenidos.*
 *  RF-023..029  progreso.*
 *  RF-030..036  evaluaciones.*
 *  RF-039..044  reportes.*
 *  RS-001..011  token en localStorage, expiración, roles en cada llamada
 * ---------------------------------------------------------------
 */
const API_BASE = "http://localhost:4000/api";
const MOCK_MODE = true; // TODO: poner en false al conectar el backend real

function obtenerRutaLogin() {
  const rutaActual = window.location.pathname || "/";
  return rutaActual.includes("/admin/") || rutaActual.includes("/trabajador/") ? "../index.html" : "index.html";
}

function navegarALogin() {
  window.location.replace(obtenerRutaLogin());
}

// ---------------------------------------------------------------
// Sesión (RS-001, RS-005, RS-006, RS-007)
// ---------------------------------------------------------------
const sesion = {
  guardar(token, usuario) {
    localStorage.setItem("cicsa_token", token);
    localStorage.setItem("cicsa_usuario", JSON.stringify(usuario));
    localStorage.setItem("cicsa_ultima_actividad", Date.now().toString());
  },
  usuario() {
    const raw = localStorage.getItem("cicsa_usuario");
    if (!raw) return null;
    try {
      const usuario = JSON.parse(raw);
      return usuario && typeof usuario === "object" ? usuario : null;
    } catch (error) {
      console.warn("La sesión almacenada no es válida.", error);
      return null;
    }
  },
  token() {
    return localStorage.getItem("cicsa_token");
  },
  rol() {
    const u = sesion.usuario();
    return u ? u.rol : null;
  },
  activa() {
    const usuario = sesion.usuario();
    return !!sesion.token() && !!usuario?.id && ["admin", "trabajador"].includes(usuario.rol);
  },
  marcarActividad() {
    localStorage.setItem("cicsa_ultima_actividad", Date.now().toString());
  },
  cerrar() {
    localStorage.removeItem("cicsa_token");
    localStorage.removeItem("cicsa_usuario");
    localStorage.removeItem("cicsa_ultima_actividad");
    navegarALogin();
  },
  /** RS-006: cierre por inactividad configurable (minutos) */
  vigilarInactividad(minutos = 20) {
    const limite = minutos * 60 * 1000;
    let ultimaActividadPorScroll = 0;
    const registrarActividadPorScroll = () => {
      const ahora = Date.now();
      if (ahora - ultimaActividadPorScroll < 1000) return;
      ultimaActividadPorScroll = ahora;
      sesion.marcarActividad();
    };
    setInterval(() => {
      const ultima = Number(localStorage.getItem("cicsa_ultima_actividad") || 0);
      if (sesion.activa() && Date.now() - ultima > limite) {
        alert("Tu sesión se cerró por inactividad.");
        sesion.cerrar();
      }
    }, 30000);
    ["click", "keydown"].forEach((ev) => window.addEventListener(ev, sesion.marcarActividad));
    window.addEventListener("scroll", registrarActividadPorScroll, { passive: true });
  },
  /** RF-003 / RS-007: protege una página según los roles permitidos */
  requerir(rolesPermitidos) {
    if (!sesion.activa()) {
      navegarALogin();
      return false;
    }
    if (rolesPermitidos && !rolesPermitidos.includes(sesion.rol())) {
      navegarALogin();
      return false;
    }
    return true;
  },
};

// ---------------------------------------------------------------
// Fetch envoltorio con token automático
// ---------------------------------------------------------------
async function solicitar(metodo, ruta, cuerpo) {
  if (MOCK_MODE) {
    const respuesta = await simularSolicitud(metodo, ruta, cuerpo);
    // Cada respuesta es independiente, igual que el JSON del backend real.
    return respuesta == null ? respuesta : JSON.parse(JSON.stringify(respuesta));
  }

  const res = await fetch(`${API_BASE}${ruta}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(sesion.token() ? { Authorization: `Bearer ${sesion.token()}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (res.status === 401 && !ruta.startsWith("/auth/")) {
    sesion.cerrar();
    throw new Error("Sesión expirada");
  }
  if (res.status === 403) {
    throw new Error("No tienes permisos para realizar esta acción.");
  }
  if (!res.ok) {
    let mensaje = "No se pudo completar la solicitud.";
    try {
      const err = await res.json();
      mensaje = err.mensaje || err.message || mensaje;
    } catch (error) {
      if (res.status >= 500) mensaje = "El servidor no está disponible. Intenta más tarde.";
    }
    throw new Error(mensaje);
  }
  return res.status === 204 ? null : res.json();
}

// ---------------------------------------------------------------
function construirModulosSeguridad() {
  const nombres = [
    ["Introducción al curso", "Introducción al curso", "Objetivos de seguridad", "Cómo usar este curso"],
    ["Módulo 1: Identificación de riesgos", "Introducción", "Tipos de riesgo laboral", "Detección de peligros"],
    ["Módulo 2: Equipo de protección personal", "Introducción", "Selección del EPP", "Uso y cuidado del EPP"],
    ["Módulo 3: Comunicación de seguridad", "Introducción", "Reporte de incidentes", "Comunicación efectiva"],
    ["Módulo 4: Señalización y áreas seguras", "Introducción", "Señales de seguridad", "Delimitación de áreas"],
    ["Módulo 5: Procedimientos de emergencia", "Introducción", "Plan de evacuación", "Punto de reunión"],
    ["Módulo 6: Trabajo en alturas", "Introducción", "Inspección del equipo", "Prevención de caídas"],
    ["Módulo 7: Manejo de herramientas", "Introducción", "Herramientas manuales", "Herramientas eléctricas"],
    ["Módulo 8: Sustancias y materiales", "Introducción", "Etiquetado de sustancias", "Almacenamiento seguro"],
    ["Módulo 9: Ergonomía y bienestar", "Introducción", "Posturas de trabajo", "Pausas y autocuidado"],
    ["Módulo 10: Repaso final", "Introducción", "Lista de verificación", "Preparación para el examen"],
  ];

  let idLeccion = 1001;
  return nombres.map(([nombre, ...lecciones]) => ({
    id: idLeccion,
    nombre,
    lecciones: lecciones.map((nombreLeccion, indice) => ({
      id: idLeccion++,
      nombre: nombreLeccion,
      tipo: indice === 1 && nombre !== "Introducción al curso" ? "video" : "texto",
    })),
  }));
}

// Datos simulados (usados mientras MOCK_MODE = true)
// ---------------------------------------------------------------
const DB = {
  usuarios: [
    { id: 1, nombre: "Ana Torres", correo: "ana.torres@cicsa.mx", rol: "admin", activo: true, puesto: "Administración", password: "Admin2026", ultimoAcceso: new Date().toISOString() },
    { id: 2, nombre: "Jhovany Gonzales", correo: "jhovany@cicsa.mx", rol: "trabajador", activo: true, password: "Cicsa2026", ultimoAcceso: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
    { id: 3, nombre: "Maria Fernanda Lopez", correo: "maria.lopez@cicsa.mx", rol: "trabajador", activo: true, password: "Cicsa2026", ultimoAcceso: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
    { id: 4, nombre: "Carlos Ramirez", correo: "carlos.ramirez@cicsa.mx", rol: "trabajador", activo: true, password: "Cicsa2026", ultimoAcceso: new Date(Date.now() - 26 * 3600 * 1000).toISOString() },
    { id: 5, nombre: "Daniela Cruz", correo: "daniela.cruz@cicsa.mx", rol: "trabajador", activo: true, password: "Cicsa2026", ultimoAcceso: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() },
    { id: 6, nombre: "Roberto Mendez", correo: "roberto.mendez@cicsa.mx", rol: "trabajador", activo: true, password: "Cicsa2026", ultimoAcceso: null },
  ],
  solicitudesRestablecimiento: [
  ],
  notificacionesAdmin: [],
  puestos: [],
  cursos: [
    {
      id: 1, nombre: "Seguridad e Higiene Industrial", categoria: "Seguridad",
      descripcion: "Protocolos de seguridad para operación en planta.", duracion: "3 h", horas: 3, asignadoA: "Todos",
      estado: "publicado", academia: "Academia técnica", tipo: "Obligatorio",
      modulos: construirModulosSeguridad(),
      evaluacion: { minimaAprobatoria: 80 },
    },
    {
      id: 2, nombre: "Atención al Cliente", categoria: "Habilidades blandas",
      descripcion: "Fundamentos de comunicación efectiva con clientes.", duracion: "2 h", horas: 2, asignadoA: "Todos",
      estado: "publicado", academia: "Academia de liderazgo", tipo: "Electivo",
      modulos: [
        { id: 3, nombre: "Comunicación efectiva", lecciones: [
          { id: 5, nombre: "Escucha activa", tipo: "texto" },
          { id: 6, nombre: "Manejo de quejas", tipo: "video" },
        ]},
      ],
      evaluacion: { minimaAprobatoria: 70 },
    },
    {
      id: 3, nombre: "Uso de Sistemas Internos", categoria: "Tecnología",
      descripcion: "Guía práctica de las plataformas internas de CICSA.", duracion: "1.5 h", horas: 1.5, asignadoA: "Todos",
      estado: "borrador", academia: "Academia técnica", tipo: "Obligatorio",
      modulos: [],
      evaluacion: { minimaAprobatoria: 70 },
    },
    {
      id: 4, nombre: "Soldador Industrial", thumbnail: "../assets/soldador.avif", categoria: "Operación industrial",
      descripcion: "Prácticas esenciales de seguridad, preparación y técnicas de soldadura.",
      duracion: "4 h", horas: 4, asignadoA: "Todos",
      estado: "publicado", academia: "Academia técnica", tipo: "Obligatorio",
      modulos: [
        { id: 4, nombre: "Fundamentos de soldadura", lecciones: [
          { id: 7, nombre: "Equipo y herramientas del soldador", tipo: "texto" },
          { id: 8, nombre: "Uso seguro del equipo de protección", tipo: "video" },
          { id: 9, nombre: "Preparación de materiales", tipo: "texto" },
        ]},
      ],
      evaluacion: { minimaAprobatoria: 80 },
    },
    {
      "id": 5,
      "nombre": "Prevención y control de incendios",
      "thumbnail": "../assets/incendios.jpg",
      "categoria": "Seguridad",
      "descripcion": "Programa integral para reconocer riesgos, prevenir incendios, responder ante una emergencia y utilizar correctamente los equipos contra incendio.",
      "duracion": "6 h",
      "horas": 6,
      "asignadoA": "Todos",
      "asignadoAIds": [],
      "estado": "publicado",
      "academia": "Academia técnica",
      "tipo": "Obligatorio",
      "modulos": [
            {
                  "id": 5,
                  "nombre": "Fundamentos del fuego",
                  "temas": [
                        {
                              "nombre": "Fundamentos del fuego",
                              "subtemas": [
                                    {
                                          "id": 10,
                                          "nombre": "El triángulo y el tetraedro del fuego",
                                          "tipo": "texto",
                                          "informacion": "Para que exista fuego se necesitan combustible, oxígeno y calor. La reacción en cadena mantiene la combustión; por eso el tetraedro del fuego agrega este cuarto elemento. Eliminar cualquiera de ellos ayuda a controlar el incendio.",
                                          "url": ""
                                    },
                                    {
                                          "id": 11,
                                          "nombre": "Clases de fuego",
                                          "tipo": "texto",
                                          "informacion": "Clase A: sólidos como madera, papel y cartón. Clase B: líquidos inflamables como gasolina, diésel y solventes. Clase C: equipos eléctricos energizados. Clase D: metales combustibles. Identificar la clase determina el agente extintor adecuado.",
                                          "url": ""
                                    },
                                    {
                                          "id": 12,
                                          "nombre": "Transferencia y propagación del calor",
                                          "tipo": "texto",
                                          "informacion": "El fuego se propaga por conducción a través de materiales, por radiación hacia objetos cercanos y por convección cuando los gases calientes ascienden. Reconocer estas rutas permite anticipar puntos de propagación.",
                                          "url": ""
                                    },
                                    {
                                          "id": 13,
                                          "nombre": "Productos de la combustión",
                                          "tipo": "texto",
                                          "informacion": "El humo, los gases tóxicos y la reducción de oxígeno pueden ser más peligrosos que las llamas. Nunca ingreses a una zona con humo sin autorización, equipo y procedimiento de emergencia.",
                                          "url": ""
                                    }
                              ]
                        }
                  ]
            },
            {
                  "id": 6,
                  "nombre": "Prevención de incendios",
                  "temas": [
                        {
                              "nombre": "Prevención de incendios",
                              "subtemas": [
                                    {
                                          "id": 14,
                                          "nombre": "Orden, limpieza y control de fuentes de ignición",
                                          "tipo": "texto",
                                          "informacion": "Mantén las áreas limpias, retira residuos combustibles, controla trabajos en caliente y evita fumar fuera de las zonas autorizadas. Reporta de inmediato chispas, fugas, calentamientos anormales u olores a quemado.",
                                          "url": ""
                                    },
                                    {
                                          "id": 15,
                                          "nombre": "Seguridad eléctrica",
                                          "tipo": "texto",
                                          "informacion": "No sobrecargues contactos, no uses cables dañados y desconecta equipos cuando el procedimiento lo indique. Las reparaciones y tableros eléctricos deben ser atendidos por personal autorizado.",
                                          "url": ""
                                    },
                                    {
                                          "id": 16,
                                          "nombre": "Almacenamiento de sustancias inflamables",
                                          "tipo": "texto",
                                          "informacion": "Conserva químicos y combustibles en recipientes autorizados, etiquetados y cerrados. Mantén separación de fuentes de calor y revisa que exista ventilación adecuada.",
                                          "url": ""
                                    },
                                    {
                                          "id": 17,
                                          "nombre": "Inspección de equipos y rutas",
                                          "tipo": "texto",
                                          "informacion": "Verifica que extintores, gabinetes, alarmas, salidas y rutas de evacuación estén visibles, señalizados, accesibles y sin obstrucciones.",
                                          "url": ""
                                    }
                              ]
                        }
                  ]
            },
            {
                  "id": 7,
                  "nombre": "Respuesta y evacuación",
                  "temas": [
                        {
                              "nombre": "Respuesta y evacuación",
                              "subtemas": [
                                    {
                                          "id": 18,
                                          "nombre": "Activación de la emergencia",
                                          "tipo": "texto",
                                          "informacion": "Al descubrir humo o fuego, conserva la calma, activa la alarma y avisa al supervisor indicando el lugar exacto. No pongas en riesgo tu integridad para recuperar objetos.",
                                          "url": ""
                                    },
                                    {
                                          "id": 19,
                                          "nombre": "Evacuación segura",
                                          "tipo": "texto",
                                          "informacion": "Dirígete por la ruta señalada al punto de reunión, camina sin correr, no uses elevadores y ayuda a las personas que lo necesiten sin separarte del grupo.",
                                          "url": ""
                                    },
                                    {
                                          "id": 20,
                                          "nombre": "Comunicación y reporte",
                                          "tipo": "texto",
                                          "informacion": "Proporciona información clara: ubicación, tamaño aproximado, materiales involucrados y personas expuestas. No regreses al área hasta recibir autorización oficial.",
                                          "url": ""
                                    },
                                    {
                                          "id": 21,
                                          "nombre": "Punto de reunión y conteo",
                                          "tipo": "texto",
                                          "informacion": "Permanece en el punto de reunión para el conteo de personal y reporta si alguien falta. Sigue las instrucciones de la brigada y de los servicios de emergencia.",
                                          "url": ""
                                    }
                              ]
                        }
                  ]
            },
            {
                  "id": 8,
                  "nombre": "Extintores y control inicial",
                  "temas": [
                        {
                              "nombre": "Extintores y control inicial",
                              "subtemas": [
                                    {
                                          "id": 22,
                                          "nombre": "Selección del extintor",
                                          "tipo": "texto",
                                          "informacion": "Elige el extintor según la clase de fuego y las instrucciones de la etiqueta. Nunca uses agua en un incendio eléctrico energizado o de líquidos inflamables.",
                                          "url": ""
                                    },
                                    {
                                          "id": 23,
                                          "nombre": "Técnica PASS",
                                          "tipo": "texto",
                                          "informacion": "P: Pull, retira el pasador. A: Aim, apunta a la base. S: Squeeze, presiona la palanca. S: Sweep, barre de lado a lado. Mantén una salida segura a tu espalda.",
                                          "url": ""
                                    },
                                    {
                                          "id": 24,
                                          "nombre": "Condiciones para intervenir",
                                          "tipo": "texto",
                                          "informacion": "Solo intenta controlar un fuego pequeño y en etapa inicial, si tienes capacitación, visibilidad, el equipo correcto y una ruta de escape libre. Si crece o genera mucho humo, evacúa.",
                                          "url": ""
                                    },
                                    {
                                          "id": 25,
                                          "nombre": "Después de usar un extintor",
                                          "tipo": "texto",
                                          "informacion": "Aléjate con precaución, informa al responsable y solicita la recarga o reemplazo del equipo. Un extintor parcialmente utilizado debe retirarse de servicio.",
                                          "url": ""
                                    }
                              ]
                        }
                  ]
            }
      ],
      "evaluacion": {
            "minimaAprobatoria": 70,
            "preguntas": [
                  {
                        "id": 1,
                        "enunciado": "¿Qué tres elementos forman el triángulo del fuego?",
                        "opciones": [
                              {
                                    "id": "a",
                                    "texto": "Combustible, oxígeno y calor"
                              },
                              {
                                    "id": "b",
                                    "texto": "Humo, agua y aire"
                              },
                              {
                                    "id": "c",
                                    "texto": "Gasolina, madera y viento"
                              }
                        ],
                        "correcta": "a"
                  },
                  {
                        "id": 2,
                        "enunciado": "Un fuego originado en líquidos inflamables (gasolina, solventes) es de clase:",
                        "opciones": [
                              {
                                    "id": "a",
                                    "texto": "Clase A"
                              },
                              {
                                    "id": "b",
                                    "texto": "Clase B"
                              },
                              {
                                    "id": "c",
                                    "texto": "Clase C"
                              }
                        ],
                        "correcta": "b"
                  },
                  {
                        "id": 3,
                        "enunciado": "Al usar un extintor con la técnica PASS, debes apuntar hacia:",
                        "opciones": [
                              {
                                    "id": "a",
                                    "texto": "La parte alta de las llamas"
                              },
                              {
                                    "id": "b",
                                    "texto": "El humo"
                              },
                              {
                                    "id": "c",
                                    "texto": "La base del fuego"
                              }
                        ],
                        "correcta": "c"
                  },
                  {
                        "id": 4,
                        "enunciado": "Si descubres un incendio, lo primero que debes hacer es:",
                        "opciones": [
                              {
                                    "id": "a",
                                    "texto": "Intentar apagarlo siempre"
                              },
                              {
                                    "id": "b",
                                    "texto": "Activar la alarma o avisar, y evacuar"
                              },
                              {
                                    "id": "c",
                                    "texto": "Abrir puertas y ventanas"
                              }
                        ],
                        "correcta": "b"
                  },
                  {
                        "id": 5,
                        "enunciado": "¿Qué debes hacer si el fuego crece o hay demasiado humo?",
                        "opciones": [
                              {
                                    "id": "a",
                                    "texto": "Continuar hasta terminar el extintor"
                              },
                              {
                                    "id": "b",
                                    "texto": "Evacuar y esperar a la brigada"
                              },
                              {
                                    "id": "c",
                                    "texto": "Abrir todas las puertas"
                              }
                        ],
                        "correcta": "b"
                  },
                  {
                        "id": 6,
                        "enunciado": "¿Cuál es una condición indispensable antes de usar un extintor?",
                        "opciones": [
                              {
                                    "id": "a",
                                    "texto": "Tener una salida segura a la espalda"
                              },
                              {
                                    "id": "b",
                                    "texto": "Estar solo en el área"
                              },
                              {
                                    "id": "c",
                                    "texto": "Acercarse sin revisar el equipo"
                              }
                        ],
                        "correcta": "a"
                  },
                  {
                        "id": 7,
                        "enunciado": "¿Dónde debe permanecer el personal durante el conteo?",
                        "opciones": [
                              {
                                    "id": "a",
                                    "texto": "En el punto de reunión"
                              },
                              {
                                    "id": "b",
                                    "texto": "Dentro del edificio"
                              },
                              {
                                    "id": "c",
                                    "texto": "En el estacionamiento sin avisar"
                              }
                        ],
                        "correcta": "a"
                  },
                  {
                        "id": 8,
                        "enunciado": "Después de descargar parcialmente un extintor se debe:",
                        "opciones": [
                              {
                                    "id": "a",
                                    "texto": "Devolverlo sin reportarlo"
                              },
                              {
                                    "id": "b",
                                    "texto": "Solicitar su recarga o reemplazo"
                              },
                              {
                                    "id": "c",
                                    "texto": "Guardarlo en cualquier lugar"
                              }
                        ],
                        "correcta": "b"
                  }
            ]
      }
},
  ],
  progreso: {
    2: { 1: { porcentaje: 65, estado: "en_proceso", completadas: [1, 2, 3] },
         2: { porcentaje: 100, estado: "completado", completadas: [5, 6] } },
  },
  evaluacionesResultado: [
    { usuario: "Jhovany Gonzales", curso: "Atención al Cliente", nota: 92, estado: "aprobado", fecha: "2026-08-12" },
  ],
  contenidoLecciones: {
    1: { tipo: "texto", cuerpo: "Un riesgo laboral es toda condición del trabajo que puede causar un accidente o una enfermedad relacionada con la actividad. En CICSA clasificamos los riesgos en físicos, químicos, biológicos, ergonómicos y psicosociales. Reconocerlos a tiempo es la primera línea de defensa antes de cualquier protocolo de seguridad." },
    2: { tipo: "video", cuerpo: "Video: cómo colocar correctamente tu equipo de protección personal (EPP) antes de ingresar a planta." },
    3: { tipo: "texto", cuerpo: "Cada área de trabajo cuenta con al menos dos rutas de evacuación señalizadas. Ubica la más cercana a tu puesto desde tu primer día y verifica que el punto de reunión esté libre de obstáculos." },
    4: { tipo: "documento", cuerpo: "Documento: procedimiento de actuación durante un simulacro de emergencia, incluyendo roles del personal de brigada." },
    5: { tipo: "texto", cuerpo: "Escuchar activamente significa prestar atención completa al cliente antes de responder: repite lo que entendiste, evita interrumpir y confirma que comprendiste su necesidad real antes de ofrecer una solución." },
    6: { tipo: "video", cuerpo: "Video: ejemplos de manejo de quejas frecuentes y cómo convertir una experiencia negativa en una oportunidad." },
    7: { tipo: "texto", cuerpo: "Conoce la máquina de soldar, cables, pinzas, electrodos y herramientas auxiliares antes de iniciar cualquier trabajo." },
    8: { tipo: "video", cuerpo: "Revisa el uso correcto del casco, careta, guantes, mandil y protección respiratoria para soldadura." },
    9: { tipo: "texto", cuerpo: "Limpia, fija y revisa los materiales antes de soldar. Una preparación correcta mejora la calidad y reduce riesgos." },
  },
  evaluaciones: {
    1: {
      minimaAprobatoria: 80,
      preguntas: [
        {
          id: 1,
          enunciado: "¿Cuál de los siguientes es un riesgo ergonómico?",
          opciones: [
            { id: "a", texto: "Ruido excesivo en planta" },
            { id: "b", texto: "Postura inadecuada al levantar carga" },
            { id: "c", texto: "Exposición a solventes" },
          ],
          correcta: "b",
        },
        {
          id: 2,
          enunciado: "Antes de usar el EPP debes:",
          opciones: [
            { id: "a", texto: "Verificar que esté en buen estado" },
            { id: "b", texto: "Usarlo solo si un supervisor lo pide" },
            { id: "c", texto: "Compartirlo con un compañero" },
          ],
          correcta: "a",
        },
      ],
    },
    2: {
      minimaAprobatoria: 70,
      preguntas: [
        {
          id: 1,
          enunciado: "La escucha activa implica principalmente:",
          opciones: [
            { id: "a", texto: "Responder lo más rápido posible" },
            { id: "b", texto: "Confirmar que entendiste antes de responder" },
            { id: "c", texto: "Repetir el guion de la empresa" },
          ],
          correcta: "b",
        },
      ],
    },
  },
};

function cargarDatosPersistidos(clave, valorInicial) {
  const guardado = localStorage.getItem(clave);
  if (!guardado) return valorInicial;
  try {
    const datos = JSON.parse(guardado);
    return Array.isArray(datos) ? datos : valorInicial;
  } catch (error) {
    console.warn(`No se pudieron cargar los datos persistidos: ${clave}`, error);
    return valorInicial;
  }
}

function guardarDatosPersistidos(clave, datos) {
  try {
    localStorage.setItem(clave, JSON.stringify(datos));
  } catch (error) {
    // El almacenamiento local (localStorage) tiene un límite de unos 5 MB por
    // sitio. Las imágenes y videos ya no se guardan aquí en base64 (van a
    // IndexedDB), pero este límite se conserva como red de seguridad por si
    // el resto de los datos guardados crece demasiado.
    if (error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014)) {
      throw new Error(
        "No se pudo guardar: se alcanzó el límite de almacenamiento del navegador. " +
        "Elimina datos que ya no necesites e inténtalo de nuevo."
      );
    }
    throw error;
  }
}

function cargarObjetoPersistido(clave, valorInicial) {
  const guardado = localStorage.getItem(clave);
  if (!guardado) return valorInicial;
  try {
    const datos = JSON.parse(guardado);
    return datos && typeof datos === "object" && !Array.isArray(datos) ? datos : valorInicial;
  } catch (error) {
    console.warn(`No se pudieron cargar los datos persistidos: ${clave}`, error);
    return valorInicial;
  }
}

// ---- Almacenamiento de imágenes/videos en IndexedDB ----
// localStorage tiene un límite de unos 5 MB por sitio, así que las imágenes y
// videos (guardados como base64) se guardan aparte en IndexedDB, que admite
// archivos mucho más pesados. En localStorage solo queda una referencia corta
// (por ejemplo "idb:media:curso-3-video") en vez del archivo completo.
const PREFIJO_MEDIA_IDB = "idb:media:";
let promesaBaseMedia = null;

function abrirBaseMedia() {
  if (promesaBaseMedia) return promesaBaseMedia;
  promesaBaseMedia = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está disponible en este navegador."));
      return;
    }
    const solicitud = indexedDB.open("cicsa_media", 1);
    solicitud.onupgradeneeded = () => {
      if (!solicitud.result.objectStoreNames.contains("archivos")) {
        solicitud.result.createObjectStore("archivos", { keyPath: "id" });
      }
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error || new Error("No se pudo abrir el almacenamiento de archivos."));
  });
  return promesaBaseMedia;
}

async function guardarArchivoMedia(id, dataUrl) {
  const baseDatos = await abrirBaseMedia();
  return new Promise((resolve, reject) => {
    const transaccion = baseDatos.transaction("archivos", "readwrite");
    transaccion.objectStore("archivos").put({ id, dataUrl });
    transaccion.oncomplete = () => resolve();
    transaccion.onerror = () => reject(transaccion.error || new Error("No se pudo guardar el archivo."));
  });
}

async function obtenerArchivoMedia(id) {
  const baseDatos = await abrirBaseMedia();
  return new Promise((resolve, reject) => {
    const transaccion = baseDatos.transaction("archivos", "readonly");
    const solicitud = transaccion.objectStore("archivos").get(id);
    solicitud.onsuccess = () => resolve(solicitud.result ? solicitud.result.dataUrl : "");
    solicitud.onerror = () => reject(solicitud.error || new Error("No se pudo leer el archivo."));
  });
}

function esDataUrl(valor) {
  return typeof valor === "string" && valor.startsWith("data:");
}

function esReferenciaMediaIdb(valor) {
  return typeof valor === "string" && valor.startsWith(PREFIJO_MEDIA_IDB);
}

// Recorre un curso clonado y, por cada campo con una imagen/video en base64,
// lo guarda en IndexedDB y deja en su lugar una referencia corta. El objeto
// `curso` original (en memoria) nunca se toca, así que la app sigue viendo
// las URLs reales sin ningún cambio en el código que las pinta en pantalla.
async function extraerMediaParaGuardar(cursoOriginal) {
  const curso = JSON.parse(JSON.stringify(cursoOriginal));
  const tareas = [];
  const extraerCampo = (objeto, campo, id) => {
    if (!objeto || !esDataUrl(objeto[campo])) return;
    const valor = objeto[campo];
    tareas.push(
      guardarArchivoMedia(id, valor).then(() => {
        objeto[campo] = PREFIJO_MEDIA_IDB + id;
      })
    );
  };
  extraerCampo(curso, "thumbnail", `curso-${curso.id}-portada`);
  extraerCampo(curso, "video", `curso-${curso.id}-video`);
  (curso.modulos || []).forEach((modulo, indiceModulo) => {
    extraerCampo(modulo, "imagen", `curso-${curso.id}-m${indiceModulo}-imagen`);
    extraerCampo(modulo, "image", `curso-${curso.id}-m${indiceModulo}-image`);
    extraerCampo(modulo, "video", `curso-${curso.id}-m${indiceModulo}-video`);
    const gruposSubtemas = modulo.temas
      ? modulo.temas.map((tema, indiceTema) => ({ tema, subtemas: tema.subtemas || [], indiceTema }))
      : [{ tema: null, subtemas: modulo.lecciones || [], indiceTema: 0 }];
    gruposSubtemas.forEach(({ tema, subtemas, indiceTema }) => {
      if (tema) {
        extraerCampo(tema, "imagen", `curso-${curso.id}-m${indiceModulo}-t${indiceTema}-imagen`);
        extraerCampo(tema, "image", `curso-${curso.id}-m${indiceModulo}-t${indiceTema}-image`);
        extraerCampo(tema, "video", `curso-${curso.id}-m${indiceModulo}-t${indiceTema}-video`);
      }
      subtemas.forEach((subtema, indiceSubtema) => {
        extraerCampo(
          subtema,
          "url",
          `curso-${curso.id}-m${indiceModulo}-t${indiceTema}-s${indiceSubtema}`
        );
      });
    });
  });
  await Promise.all(tareas);
  return curso;
}

// Operación inversa: reemplaza cada referencia "idb:media:<id>" por el
// archivo real guardado en IndexedDB, para que el curso en memoria siempre
// tenga URLs directamente utilizables (data URLs, http o rutas relativas).
async function resolverMediaAlCargar(cursoOriginal) {
  const curso = cursoOriginal;
  const tareas = [];
  const resolverCampo = (objeto, campo) => {
    if (!objeto || !esReferenciaMediaIdb(objeto[campo])) return;
    const id = objeto[campo].slice(PREFIJO_MEDIA_IDB.length);
    tareas.push(
      obtenerArchivoMedia(id).then((dataUrl) => {
        objeto[campo] = dataUrl || "";
      })
    );
  };
  resolverCampo(curso, "thumbnail");
  resolverCampo(curso, "video");
  (curso.modulos || []).forEach((modulo) => {
    resolverCampo(modulo, "imagen");
    resolverCampo(modulo, "image");
    resolverCampo(modulo, "video");
    const gruposSubtemas = modulo.temas
      ? modulo.temas.map((tema) => ({ tema, subtemas: tema.subtemas || [] }))
      : [{ tema: null, subtemas: modulo.lecciones || [] }];
    gruposSubtemas.forEach(({ tema, subtemas }) => {
      if (tema) {
        resolverCampo(tema, "imagen");
        resolverCampo(tema, "image");
        resolverCampo(tema, "video");
      }
      subtemas.forEach((subtema) => resolverCampo(subtema, "url"));
    });
  });
  await Promise.all(tareas);
  return curso;
}

async function guardarCursosPersistidos(cursos) {
  const cursosParaGuardar = await Promise.all(cursos.map((curso) => extraerMediaParaGuardar(curso)));
  guardarDatosPersistidos("cicsa_cursos", cursosParaGuardar);
}

async function cargarCursosPersistidos(valorInicial) {
  const cursos = cargarDatosPersistidos("cicsa_cursos", valorInicial);
  await Promise.all(cursos.map((curso) => resolverMediaAlCargar(curso)));
  return cursos;
}

DB.usuarios = cargarDatosPersistidos("cicsa_usuarios", DB.usuarios);
// Datos demo con áreas reales para que filtros, perfiles y reportes funcionen desde el primer uso.
const areasDemoPorTrabajador = {
  2: "Operaciones",
  3: "Seguridad",
  4: "Mantenimiento",
  5: "Seguridad",
  6: "Logística",
};
let areasDemoActualizadas = false;
DB.usuarios.forEach((u) => {
  if (u.rol === "trabajador" && (!u.area || u.area === "Sin asignar") && areasDemoPorTrabajador[u.id]) {
    u.area = areasDemoPorTrabajador[u.id];
    areasDemoActualizadas = true;
  }
});
if (areasDemoActualizadas) guardarDatosPersistidos("cicsa_usuarios", DB.usuarios);
DB.progreso = cargarObjetoPersistido("cicsa_progreso", DB.progreso);
DB.solicitudesRestablecimiento = cargarDatosPersistidos(
  "cicsa_solicitudes_restablecimiento",
  DB.solicitudesRestablecimiento
);
DB.notificacionesAdmin = cargarDatosPersistidos("cicsa_notificaciones_admin", DB.notificacionesAdmin);
DB.evaluacionesResultado = cargarDatosPersistidos("cicsa_evaluaciones_resultado", DB.evaluacionesResultado);
DB.evaluaciones = cargarObjetoPersistido("cicsa_evaluaciones", DB.evaluaciones);
const dbListaPromise = (async () => {
  // Los datos iniciales solo se usan cuando todavía no hay cursos guardados.
  DB.cursos = await cargarCursosPersistidos(DB.cursos);
})();

function pausa(ms) { return new Promise((r) => setTimeout(r, ms)); }

function requerirAdministrador() {
  if (!sesion.activa() || sesion.rol() !== "admin") {
    throw new Error("Solo un administrador puede consultar o modificar contraseñas.");
  }
}

function estadoTemporalCurso(curso, ahora = new Date()) {
  const inicio = curso?.fechaInicio ? new Date(curso.fechaInicio) : null;
  const fin = curso?.fechaFin ? new Date(curso.fechaFin) : null;
  if (inicio && ahora < inicio) return "programado";
  if (fin && ahora > fin) return "cerrado";
  return "abierto";
}

function obtenerLeccionesCurso(curso) {
  return (curso.modulos || []).flatMap((modulo) =>
    modulo.temas
      ? modulo.temas.flatMap((tema) => tema.subtemas || [])
      : modulo.lecciones || []
  );
}

async function simularSolicitud(metodo, ruta, cuerpo) {
  await dbListaPromise;
  await pausa(280);

  if (!ruta.startsWith("/auth/") && !sesion.activa()) {
    throw new Error("Inicia sesión para continuar.");
  }

  // ---- Auth ----
  if (ruta === "/auth/login" && metodo === "POST") {
    const u = DB.usuarios.find(
      (x) => x.correo.toLowerCase() === String(cuerpo.correo).toLowerCase()
    );
    if (!u || u.password !== cuerpo.password) throw new Error("Usuario o contraseña incorrectos.");
    if (!u.activo) throw new Error("Esta cuenta está desactivada. Contacta a un administrador.");
    u.ultimoAcceso = new Date().toISOString();
    guardarDatosPersistidos("cicsa_usuarios", DB.usuarios);
    return { token: "token-demo." + u.id, usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol } };
  }
  if (ruta === "/auth/olvide-password" && metodo === "POST") {
    const usuario = DB.usuarios.find((u) => u.correo.toLowerCase() === String(cuerpo.correo).toLowerCase());
    const administrador = DB.usuarios.find((u) => u.rol === "admin" && u.activo);
    if (usuario && !DB.solicitudesRestablecimiento.some((s) => s.usuarioId === usuario.id && s.estado === "pendiente")) {
      DB.solicitudesRestablecimiento.push({
        id: DB.solicitudesRestablecimiento.length ? Math.max(...DB.solicitudesRestablecimiento.map((s) => s.id)) + 1 : 1,
        usuarioId: usuario.id,
        fecha: new Date().toISOString(),
        estado: "pendiente",
      });
      guardarDatosPersistidos("cicsa_solicitudes_restablecimiento", DB.solicitudesRestablecimiento);
      guardarDatosPersistidos("cicsa_usuarios", DB.usuarios);
      DB.notificacionesAdmin.unshift({
        id: `password-${usuario.id}-${Date.now()}`,
        tipo: "password",
        fecha: new Date().toISOString(),
        usuarioId: usuario.id,
        destinatario: administrador?.correo || null,
        leida: false,
      });
      guardarDatosPersistidos("cicsa_notificaciones_admin", DB.notificacionesAdmin);
    }
    return { mensaje: "Si el correo existe, se notificó al administrador." };
  }
  if (ruta === "/auth/restablecer-password" && metodo === "POST") {
    requerirAdministrador();
    return { mensaje: "Contraseña actualizada correctamente." };
  }

  // ---- Usuarios (admin) ----
  if (ruta === "/usuarios" && metodo === "GET") {
    requerirAdministrador();
    return DB.usuarios;
  }
  if (ruta === "/usuarios" && metodo === "POST") {
    requerirAdministrador();
    const nuevoId = DB.usuarios.length ? Math.max(...DB.usuarios.map((u) => u.id)) + 1 : 1;
    const rol = String(cuerpo.rol || "").trim().toLowerCase();
    if (!["admin", "trabajador"].includes(rol)) {
      throw new Error("El rol seleccionado no es válido.");
    }
    const nuevo = { id: nuevoId, activo: true, ultimoAcceso: null, area: String(cuerpo.area || "Sin asignar").trim(), ...cuerpo, rol };
    DB.usuarios.push(nuevo);
    guardarDatosPersistidos("cicsa_usuarios", DB.usuarios);
    return nuevo;
  }
  if (ruta === "/usuarios/importar" && metodo === "POST") {
    requerirAdministrador();
    const registros = Array.isArray(cuerpo.registros) ? cuerpo.registros : [];
    if (!registros.length) throw new Error("No hay trabajadores para importar.");
    const existentes = new Set(DB.usuarios.map((u) => String(u.correo || "").toLowerCase()));
    let siguienteId = DB.usuarios.length ? Math.max(...DB.usuarios.map((u) => Number(u.id) || 0)) + 1 : 1;
    const creados = [], omitidos = [];
    registros.forEach((registro) => {
      const nombre = String(registro.nombre || "").trim();
      const area = String(registro.area || "").trim() || "Sin asignar";
      if (!nombre) { omitidos.push({ ...registro, motivo: "Falta el nombre" }); return; }
      const correoBase = String(registro.correo || "").trim().toLowerCase();
      const correo = correoBase || (nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(" ").filter(Boolean).slice(0,2).join(".") + "@cicsa.mx");
      if (existentes.has(correo)) { omitidos.push({ ...registro, motivo: "Correo ya registrado" }); return; }
      const password = String(registro.password || "Cicsa2026").trim() || "Cicsa2026";
      const nuevo = { id: siguienteId++, nombre, correo, password, rol: "trabajador", activo: true, ultimoAcceso: null, area };
      DB.usuarios.push(nuevo); existentes.add(correo); creados.push(nuevo);
    });
    guardarDatosPersistidos("cicsa_usuarios", DB.usuarios);
    return { creados, omitidos };
  }
  const matchToggle = ruta.match(/^\/usuarios\/(\d+)\/estado$/);
  if (matchToggle && metodo === "PATCH") {
    requerirAdministrador();
    const u = DB.usuarios.find((x) => x.id == matchToggle[1]);
    if (u) u.activo = cuerpo.activo;
    guardarDatosPersistidos("cicsa_usuarios", DB.usuarios);
    return u;
  }
  const matchPassword = ruta.match(/^\/usuarios\/(\d+)\/password$/);
  if (matchPassword && metodo === "PATCH") {
    requerirAdministrador();
    const u = DB.usuarios.find((x) => x.id == matchPassword[1]);
    if (u) u.password = cuerpo.password;
    guardarDatosPersistidos("cicsa_usuarios", DB.usuarios);
    return u;
  }
  const matchRol = ruta.match(/^\/usuarios\/(\d+)\/rol$/);
  if (matchRol && metodo === "PATCH") {
    requerirAdministrador();
    const rol = String(cuerpo.rol || "").trim().toLowerCase();
    if (!["admin", "trabajador"].includes(rol)) {
      throw new Error("El rol seleccionado no es válido.");
    }
    const u = DB.usuarios.find((x) => x.id == matchRol[1]);
    if (!u) throw new Error("Trabajador no encontrado.");
    u.rol = rol;
    guardarDatosPersistidos("cicsa_usuarios", DB.usuarios);
    return u;
  }

  // ---- Solicitudes de restablecimiento (admin) ----
  if (ruta === "/solicitudes-restablecimiento" && metodo === "GET") {
    requerirAdministrador();
    return DB.solicitudesRestablecimiento.map((s) => ({
      ...s,
      usuario: DB.usuarios.find((u) => u.id === s.usuarioId),
    }));
  }
  if (ruta === "/notificaciones-admin" && metodo === "GET") {
    requerirAdministrador();
    return DB.notificacionesAdmin.map((n) => ({
      ...n,
      usuario: DB.usuarios.find((u) => u.id === n.usuarioId),
      curso: n.cursoId ? DB.cursos.find((c) => c.id === n.cursoId) : null,
    }));
  }
  if (ruta === "/notificaciones-admin" && metodo === "DELETE") {
    requerirAdministrador();
    DB.notificacionesAdmin = [];
    guardarDatosPersistidos("cicsa_notificaciones_admin", DB.notificacionesAdmin);
    return { mensaje: "Notificaciones eliminadas." };
  }
  const matchNotificacion = ruta.match(/^\/notificaciones-admin\/([^/]+)$/);
  if (matchNotificacion && metodo === "DELETE") {
    requerirAdministrador();
    const indice = DB.notificacionesAdmin.findIndex((n) => String(n.id) === decodeURIComponent(matchNotificacion[1]));
    if (indice < 0) throw new Error("Notificación no encontrada.");
    DB.notificacionesAdmin.splice(indice, 1);
    guardarDatosPersistidos("cicsa_notificaciones_admin", DB.notificacionesAdmin);
    return { mensaje: "Notificación eliminada." };
  }
  const matchResolverSolicitud = ruta.match(/^\/solicitudes-restablecimiento\/(\d+)\/resolver$/);
  if (matchResolverSolicitud && metodo === "POST") {
    requerirAdministrador();
    const s = DB.solicitudesRestablecimiento.find((x) => x.id == matchResolverSolicitud[1]);
    if (s) {
      s.estado = "resuelto";
      const u = DB.usuarios.find((x) => x.id === s.usuarioId);
      if (u) u.password = cuerpo.password;
      guardarDatosPersistidos("cicsa_usuarios", DB.usuarios);
      guardarDatosPersistidos("cicsa_solicitudes_restablecimiento", DB.solicitudesRestablecimiento);
    }
    return s;
  }

  // ---- Cursos ----
  if (ruta === "/cursos" && metodo === "GET") return DB.cursos;
  const matchCurso = ruta.match(/^\/cursos\/(\d+)$/);
  if (matchCurso && metodo === "GET") {
    const curso = DB.cursos.find((c) => c.id == matchCurso[1]);
    if (!curso) throw new Error("No se encontró el curso.");
    const usuario = sesion.usuario();
    if (usuario?.rol === "trabajador" && curso.estado !== "publicado") throw new Error("Este curso no está publicado.");
    if (usuario?.rol === "trabajador" && curso && curso.asignadoA !== "Todos"
      && !(Array.isArray(curso.asignadoAIds) && curso.asignadoAIds.includes(Number(usuario.id)))) {
      throw new Error("No tienes permiso para realizar este curso.");
    }
    if (usuario?.rol === "trabajador" && curso) {
      const temporal = estadoTemporalCurso(curso);
      if (temporal === "programado") throw new Error(`Este curso aún no está abierto. Apertura: ${new Date(curso.fechaInicio).toLocaleString("es-MX")}.`);
      if (temporal === "cerrado") throw new Error("El periodo de este curso ya terminó.");
    }
    return curso;
  }
  if (ruta === "/cursos" && metodo === "POST") {
    requerirAdministrador();
    const nuevo = {
      id: DB.cursos.reduce((mayor, curso) => Math.max(mayor, Number(curso.id) || 0), 0) + 1,
      modulos: [],
      estado: "publicado",
      ...cuerpo,
    };
    DB.cursos.push(nuevo);
    try {
      await guardarCursosPersistidos(DB.cursos);
    } catch (error) {
      DB.cursos.pop();
      throw error;
    }
    return nuevo;
  }
  const matchEstadoCurso = ruta.match(/^\/cursos\/(\d+)\/estado$/);
  if (matchEstadoCurso && metodo === "PATCH") {
    requerirAdministrador();
    const c = DB.cursos.find((x) => x.id == matchEstadoCurso[1]);
    const estadoAnterior = c?.estado;
    if (c) c.estado = cuerpo.estado;
    try {
      await guardarCursosPersistidos(DB.cursos);
    } catch (error) {
      if (c) c.estado = estadoAnterior;
      throw error;
    }
    return c;
  }
  const matchEditarCurso = ruta.match(/^\/cursos\/(\d+)$/);
  if (matchEditarCurso && metodo === "PATCH") {
    requerirAdministrador();
    const c = DB.cursos.find((x) => x.id == matchEditarCurso[1]);
    const anterior = c ? { ...c } : null;
    if (c) Object.assign(c, cuerpo);
    try {
      await guardarCursosPersistidos(DB.cursos);
    } catch (error) {
      if (c && anterior) Object.assign(c, anterior);
      throw error;
    }
    return c;
  }
  if (matchEditarCurso && metodo === "DELETE") {
    requerirAdministrador();
    const anteriores = DB.cursos;
    DB.cursos = DB.cursos.filter((x) => x.id != matchEditarCurso[1]);
    try {
      await guardarCursosPersistidos(DB.cursos);
    } catch (error) {
      DB.cursos = anteriores;
      throw error;
    }
    return { ok: true };
  }

  // ---- Progreso ----
  if (ruta === "/progreso/mis-cursos" && metodo === "GET") {
    const idUsuario = sesion.usuario()?.id;
    const propio = DB.progreso[idUsuario] || {};
    return DB.cursos
      .filter((c) => c.estado === "publicado" && (
        c.asignadoA === "Todos" ||
        (Array.isArray(c.asignadoAIds) && c.asignadoAIds.includes(Number(idUsuario)))
      ))
      .map((c) => ({ curso: c, estadoTemporal: estadoTemporalCurso(c), progreso: propio[c.id] || { porcentaje: 0, estado: "no_iniciado", completadas: [] } }));
  }
  const matchCompletar = ruta.match(/^\/progreso\/leccion\/(\d+)\/completar$/);
  if (matchCompletar && metodo === "POST") {
    const usuario = sesion.usuario();
    const curso = DB.cursos.find((c) => obtenerLeccionesCurso(c).some((l) => l.id == matchCompletar[1]));
    const autorizado = curso && curso.estado === "publicado" && estadoTemporalCurso(curso) === "abierto" && (curso.asignadoA === "Todos"
      || (Array.isArray(curso.asignadoAIds) && curso.asignadoAIds.includes(Number(usuario?.id))));
    if (usuario?.rol === "trabajador" && autorizado) {
      const propio = DB.progreso[usuario.id] || (DB.progreso[usuario.id] = {});
      const progreso = propio[curso.id] || (propio[curso.id] = { porcentaje: 0, estado: "no_iniciado", completadas: [] });
      const leccionId = Number(matchCompletar[1]);
      if (!progreso.completadas.includes(leccionId)) progreso.completadas.push(leccionId);
      const totalLecciones = obtenerLeccionesCurso(curso).length;
      progreso.porcentaje = totalLecciones ? Math.round((progreso.completadas.length / totalLecciones) * 100) : 0;
      progreso.estado = progreso.examenAprobado ? "completado" : progreso.porcentaje === 100 ? "listo_examen" : progreso.porcentaje > 0 ? "en_proceso" : "no_iniciado";
      guardarDatosPersistidos("cicsa_progreso", DB.progreso);
      if (progreso.estado === "listo_examen" && !DB.notificacionesAdmin.some((n) => n.tipo === "curso-listo" && n.usuarioId === usuario.id && n.cursoId === curso.id)) {
        DB.notificacionesAdmin.unshift({
          id: `curso-listo-${usuario.id}-${curso.id}`,
          tipo: "curso-listo",
          fecha: new Date().toISOString(),
          usuarioId: usuario.id,
          cursoId: curso.id,
          leida: false,
        });
        guardarDatosPersistidos("cicsa_notificaciones_admin", DB.notificacionesAdmin);
      }
    }
    if (usuario?.rol === "trabajador" && !autorizado) {
      throw new Error("No tienes permiso para realizar este curso.");
    }
    return { ok: true };
  }

  // ---- Reportes (admin) ----
  const matchPerfilTrabajador = ruta.match(/^\/reportes\/trabajador\/(\d+)\/perfil$/);
  if (matchPerfilTrabajador && metodo === "GET") {
    requerirAdministrador();
    const usuarioId = Number(matchPerfilTrabajador[1]);
    const usuario = DB.usuarios.find((u) => u.id === usuarioId && u.rol === "trabajador");
    if (!usuario) throw new Error("No se encontró el trabajador.");

    const cursosAsignados = DB.cursos.filter((c) => c.estado === "publicado" && (
      c.asignadoA === "Todos" || (Array.isArray(c.asignadoAIds) && c.asignadoAIds.includes(usuarioId))
    ));
    const propio = DB.progreso[usuarioId] || {};
    const cursos = cursosAsignados.map((curso) => {
      const avance = propio[curso.id] || { porcentaje: 0, estado: "no_iniciado" };
      const resultado = DB.evaluacionesResultado
        .filter((r) => (r.usuarioId === usuarioId || (!r.usuarioId && r.usuario === usuario.nombre)) && r.curso === curso.nombre)
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))[0];
      return {
        nombre: curso.nombre,
        porcentaje: avance.porcentaje || 0,
        completado: avance.estado === "completado",
        calificacion: resultado?.nota ?? null,
      };
    });
    const calificaciones = DB.evaluacionesResultado
      .filter((r) => r.usuarioId === usuarioId || (!r.usuarioId && r.usuario === usuario.nombre))
      .map((r) => r.nota)
      .filter(Number.isFinite);
    const promedio = calificaciones.length ? Math.round(calificaciones.reduce((suma, nota) => suma + nota, 0) / calificaciones.length) : null;
    const cursosCompletados = cursos.filter((curso) => curso.completado).length;
    const avanceGeneral = cursos.length ? Math.round(cursos.reduce((suma, curso) => suma + curso.porcentaje, 0) / cursos.length) : 0;
    const horasHechas = cursosAsignados.reduce((suma, curso) => suma + ((propio[curso.id]?.porcentaje || 0) / 100) * (curso.horas || 0), 0);
    const insignias = [];
    if (cursosCompletados) insignias.push("Curso completado");
    if (avanceGeneral >= 50) insignias.push("Avance constante");
    if (promedio !== null && promedio >= 90) insignias.push("Alto desempeño");
    return {
      usuario: { nombre: usuario.nombre, correo: usuario.correo, area: usuario.area || "Sin asignar" }, avanceGeneral,
      horasHechas: Math.round(horasHechas * 10) / 10, cursosCompletados,
      cursosTotal: cursos.length, promedio, insignias, cursos,
    };
  }
  if (ruta.startsWith("/reportes/seguimiento-trabajadores") && metodo === "GET") {
    requerirAdministrador();
    const cursosPublicados = DB.cursos.filter((c) => c.estado === "publicado");
    return DB.usuarios
      .filter((u) => u.rol === "trabajador")
      .map((u) => {
        const cursosAsignados = cursosPublicados.filter((c) => c.asignadoA === "Todos" || c.asignadoAIds?.includes(Number(u.id)));
        const totalHoras = cursosAsignados.reduce((sum, c) => sum + (c.horas || 0), 0);
        const propio = DB.progreso[u.id] || {};
        const cursosCompletados = cursosAsignados.filter((c) => propio[c.id]?.estado === "completado").length;
        const horasHechas = cursosAsignados.reduce(
          (sum, c) => sum + ((propio[c.id]?.porcentaje || 0) / 100) * (c.horas || 0), 0
        );
        const avance = cursosAsignados.length
          ? Math.round(cursosAsignados.reduce((sum, c) => sum + (propio[c.id]?.porcentaje || 0), 0) / cursosAsignados.length)
          : 0;
        let estado = "Sin iniciar";
        if (cursosAsignados.length > 0 && cursosCompletados === cursosAsignados.length) estado = "Completado";
        else if (avance > 0) estado = "En progreso";
        return {
          usuarioId: u.id, nombre: u.nombre, area: u.area || "Sin asignar", avance,
          cursosCompletados, cursosTotal: cursosAsignados.length,
          horasHechas: Math.round(horasHechas * 10) / 10, horasTotal: totalHoras,
          estado,
        };
      });
  }
  if (ruta.startsWith("/reportes/seguimiento") && metodo === "GET") {
    requerirAdministrador();
    return DB.evaluacionesResultado;
  }
  if (ruta === "/reportes/mis-resultados" && metodo === "GET") {
    const usuario = sesion.usuario();
    return DB.evaluacionesResultado.filter((resultado) => resultado.usuarioId === usuario?.id || (!resultado.usuarioId && resultado.usuario === usuario?.nombre));
  }

  // ---- Contenido de lección ----
  const matchLeccion = ruta.match(/^\/lecciones\/(\d+)$/);
  if (matchLeccion && metodo === "GET") {
    return DB.contenidoLecciones[matchLeccion[1]];
  }

  // ---- Evaluaciones (RF-030..036) ----
  const matchEvalTipo = ruta.match(/^\/evaluaciones\/curso\/(\d+)\/(evaluacion|examen)$/);
  if (matchEvalTipo && metodo === "GET") {
    const id = matchEvalTipo[1];
    const tipo = matchEvalTipo[2];
    const actual = DB.evaluaciones[id];
    if (!actual) return null;
    // Compatibilidad: los datos anteriores se consideran examen final.
    if (actual.preguntas && !actual.examen && !actual.evaluacion) return tipo === "examen" ? actual : null;
    return actual[tipo] || null;
  }
  if (matchEvalTipo && metodo === "PATCH") {
    requerirAdministrador();
    const id = matchEvalTipo[1];
    const tipo = matchEvalTipo[2];
    const previo = DB.evaluaciones[id];
    const base = previo && previo.preguntas && !previo.examen && !previo.evaluacion
      ? { evaluacion: { minimaAprobatoria: 70, preguntas: [] }, examen: previo }
      : { evaluacion: null, examen: null, ...(previo || {}) };
    base[tipo] = { ...(base[tipo] || {}), ...cuerpo };
    DB.evaluaciones[id] = base;
    guardarDatosPersistidos("cicsa_evaluaciones", DB.evaluaciones);
    return base[tipo];
  }
  const matchEval = ruta.match(/^\/evaluaciones\/curso\/(\d+)$/);
  if (matchEval && metodo === "GET") {
    const actual = DB.evaluaciones[matchEval[1]];
    if (actual && (actual.evaluacion || actual.examen)) return actual.examen || actual.evaluacion || null;
    return actual || null;
  }
  if (matchEval && metodo === "PATCH") {
    requerirAdministrador();
    const actual = DB.evaluaciones[matchEval[1]] || { preguntas: [] };
    DB.evaluaciones[matchEval[1]] = { ...actual, ...cuerpo };
    guardarDatosPersistidos("cicsa_evaluaciones", DB.evaluaciones);
    return DB.evaluaciones[matchEval[1]];
  }
  const matchIntento = ruta.match(/^\/evaluaciones\/curso\/(\d+)\/(evaluacion|examen)\/intento$/);
  const matchIntentoLegacy = ruta.match(/^\/evaluaciones\/curso\/(\d+)\/intento$/);
  if ((matchIntento || matchIntentoLegacy) && metodo === "POST") {
    const idCursoIntento = matchIntento ? matchIntento[1] : matchIntentoLegacy[1];
    const tipoIntento = matchIntento ? matchIntento[2] : "examen";
    const cursoIntento = await simularSolicitud("GET", `/cursos/${idCursoIntento}`);
    const avanceIntento = DB.progreso[sesion.usuario().id]?.[idCursoIntento];
    if (tipoIntento === "examen" && obtenerLeccionesCurso(cursoIntento).some((l) => !avanceIntento?.completadas?.includes(l.id))) {
      throw new Error("Completa todas las lecciones antes del examen final.");
    }
    const registro = DB.evaluaciones[idCursoIntento];
    const evalCurso = registro && (registro.evaluacion || registro.examen) ? registro[tipoIntento] : registro;
    if (!evalCurso || !evalCurso.preguntas?.length) {
      throw new Error("Este curso todavía no tiene preguntas configuradas.");
    }
    const total = evalCurso.preguntas.length;
    const correctas = evalCurso.preguntas.filter((p) => cuerpo?.respuestas?.[p.id] != null && String(cuerpo.respuestas[p.id]) === String(p.correcta)).length;
    const nota = Math.round((correctas / total) * 100);
    const aprobado = nota >= evalCurso.minimaAprobatoria;
    const usuario = sesion.usuario();
    DB.evaluacionesResultado.unshift({
      usuarioId: usuario?.id,
      usuario: usuario?.nombre || "Trabajador",
      curso: DB.cursos.find((curso) => curso.id === Number(idCursoIntento))?.nombre || "Curso",
      tipo: tipoIntento,
      nota,
      estado: aprobado ? "aprobado" : "no aprobado",
      fecha: new Date().toISOString().slice(0, 10),
    });
    guardarDatosPersistidos("cicsa_evaluaciones_resultado", DB.evaluacionesResultado);
    if (aprobado && tipoIntento === "examen") {
      const propio = DB.progreso[usuario.id] || (DB.progreso[usuario.id] = {});
      const progresoCurso = propio[idCursoIntento] || (propio[idCursoIntento] = { porcentaje: 100, completadas: [] });
      if (progresoCurso) {
        progresoCurso.estado = "completado";
        progresoCurso.fechaFin = new Date().toISOString().slice(0, 10);
        progresoCurso.examenAprobado = true;
        guardarDatosPersistidos("cicsa_progreso", DB.progreso);
      }
      const cursoTerminado = DB.cursos.find((curso) => curso.id === Number(idCursoIntento));
      if (usuario?.id && cursoTerminado && !DB.notificacionesAdmin.some((n) => n.tipo === "curso-completado" && n.usuarioId === usuario.id && n.cursoId === cursoTerminado.id)) {
        DB.notificacionesAdmin.unshift({
          id: `curso-completado-${usuario.id}-${cursoTerminado.id}`,
          tipo: "curso-completado",
          fecha: new Date().toISOString(),
          usuarioId: usuario.id,
          cursoId: cursoTerminado.id,
          nota,
          leida: false,
        });
        guardarDatosPersistidos("cicsa_notificaciones_admin", DB.notificacionesAdmin);
      }
    }
    return { nota, aprobado, correctas, total };
  }

  throw new Error(`Endpoint simulado no implementado: ${metodo} ${ruta}`);
}

// ---------------------------------------------------------------
// API pública usada por las páginas
// ---------------------------------------------------------------
const auth = {
  login: (correo, password) => solicitar("POST", "/auth/login", { correo, password }),
  olvidePassword: (correo) => solicitar("POST", "/auth/olvide-password", { correo }),
  restablecerPassword: (token, password) =>
    solicitar("POST", "/auth/restablecer-password", { token, password }),
};

const usuarios = {
  listar: () => solicitar("GET", "/usuarios"),
  crear: (datos) => solicitar("POST", "/usuarios", datos),
  cambiarEstado: (id, activo) => solicitar("PATCH", `/usuarios/${id}/estado`, { activo }),
  cambiarPassword: (id, password) => solicitar("PATCH", `/usuarios/${id}/password`, { password }),
  cambiarRol: (id, rol) => solicitar("PATCH", `/usuarios/${id}/rol`, { rol }),
  importar: (registros) => solicitar("POST", "/usuarios/importar", { registros }),
};

const solicitudesReset = {
  listar: () => solicitar("GET", "/solicitudes-restablecimiento"),
  resolver: (id, password) => solicitar("POST", `/solicitudes-restablecimiento/${id}/resolver`, { password }),
};

const notificacionesAdmin = {
  listar: () => solicitar("GET", "/notificaciones-admin"),
  eliminar: (id) => solicitar("DELETE", `/notificaciones-admin/${encodeURIComponent(id)}`),
  eliminarTodas: () => solicitar("DELETE", "/notificaciones-admin"),
};

const cursos = {
  listar: () => solicitar("GET", "/cursos"),
  obtener: (id) => solicitar("GET", `/cursos/${id}`),
  crear: (datos) => solicitar("POST", "/cursos", datos),
  actualizar: (id, datos) => solicitar("PATCH", `/cursos/${id}`, datos),
  eliminar: (id) => solicitar("DELETE", `/cursos/${id}`),
  cambiarEstado: (id, estado) => solicitar("PATCH", `/cursos/${id}/estado`, { estado }),
};

const progreso = {
  misCursos: () => solicitar("GET", "/progreso/mis-cursos"),
  completarLeccion: (idLeccion) => solicitar("POST", `/progreso/leccion/${idLeccion}/completar`),
};

const lecciones = {
  obtener: (id) => solicitar("GET", `/lecciones/${id}`),
};

const evaluaciones = {
  obtenerPorCurso: (idCurso) => solicitar("GET", `/evaluaciones/curso/${idCurso}`),
  obtenerPorCursoTipo: (idCurso, tipo = "examen") => solicitar("GET", `/evaluaciones/curso/${idCurso}/${tipo}`),
  actualizar: (idCurso, datos) => solicitar("PATCH", `/evaluaciones/curso/${idCurso}`, datos),
  actualizarTipo: (idCurso, tipo, datos) => solicitar("PATCH", `/evaluaciones/curso/${idCurso}/${tipo}`, datos),
  enviarIntento: (idCurso, respuestas, tipo = "examen") =>
    solicitar("POST", `/evaluaciones/curso/${idCurso}/${tipo}/intento`, { respuestas }),
};

const reportes = {
  seguimiento: (filtros = {}) => {
    const qs = new URLSearchParams(filtros).toString();
    return solicitar("GET", `/reportes/seguimiento?${qs}`);
  },
  seguimientoTrabajadores: () => solicitar("GET", "/reportes/seguimiento-trabajadores"),
  perfilTrabajador: (id) => solicitar("GET", `/reportes/trabajador/${id}/perfil`),
  misResultados: () => solicitar("GET", "/reportes/mis-resultados"),
  exportarCSV(filas, nombreArchivo = "reporte-cicsa-capacita.csv") {
    const encabezados = Object.keys(filas[0] || {});
    const lineas = [
      encabezados.join(","),
      ...filas.map((f) => encabezados.map((h) => `"${f[h]}"`).join(",")),
    ];
    const blob = new Blob([lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  },
};
