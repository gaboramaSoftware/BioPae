import { useState } from "react";

const DAYS = [
  {
    day: "Lunes (hoy)",
    title: "Limpieza: eliminar código muerto + unificar sesiones DB",
    priority: "CRÍTICO",
    hours: "~4h",
    color: "#E24B4A",
    tasks: [
      {
        title: "Eliminar 12 archivos de código muerto",
        description:
          "Hay 12 archivos .py que NO son importados por main.py ni por ningún archivo activo. Son vestigios de iteraciones anteriores que solo generan confusión.",
        files: [
          "core/Services/registroServices/registroService.py — duplica lógica de RegistroRepository",
          "core/Services/userServces/Atributos/CursoService.py — reemplazado por _resolver_curso_id() en main.py",
          "core/Services/userServces/Atributos/nombreService.py — nunca conectado",
          "core/Services/userServces/Atributos/RunService.py — validación de RUT no usada",
          "core/Services/userServces/Usuario/alumnoService.py — imports rotos (huellaCoontroller con typo, variables globales inexistentes)",
          "core/Services/identificacionService.py/ — es un DIRECTORIO, no un archivo",
          "core/Domain/Repository/alumnosRepository.py — tiene string literal de ruta Windows suelto, Session() sin engine",
          "core/Domain/Entities/usuario.py — importa 'pydentic' (typo), clase UsuarioBase no existe",
          "core/Domain/Entities/huella.py — revisar si es usado",
          "infra/Controller/Alumno/cursoController.py — no conectado",
          "infra/Controller/Alumno/rutController.py — no conectado",
          "infra/Controller/Alumno/NombreController.py — no conectado",
          "infra/Controller/huella/enrolarController.py — reemplazado por HuellaController",
          "infra/repo/repoRegistro.py — duplica RegistroRepository, crea sesión sin engine",
          "infra/ports/puertos.py — no conectado",
        ],
        impact: "Eliminas ~400 líneas de código muerto y reduces confusión al navegar el proyecto.",
      },
      {
        title: "Crear middleware de sesión DB con FastAPI Depends",
        description:
          "Actualmente hay 32 llamadas a SessionLocal() dispersas en 7 archivos. Cada función crea y cierra su propia sesión. En procesarAsistencia() se abren 4 sesiones separadas para una sola operación. Esto es ineficiente y riesgoso bajo concurrencia.",
        files: [
          "infra/main.py — 15 llamadas a SessionLocal()",
          "infra/Controller/RegistrosController.py — 7 llamadas",
          "core/Domain/Repository/UserRepository.py — 5 llamadas",
          "core/Domain/Repository/RegistroRepository.py — 3 llamadas",
        ],
        code: `# ANTES (repetido 32 veces):
db = SessionLocal()
try:
    # ... lógica ...
finally:
    db.close()

# DESPUÉS — crear en infra/dependencies.py:
from fastapi import Depends
from sqlalchemy.orm import Session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Usar en endpoints:
@app.get("/api/usuarios")
def obtener_usuarios(db: Session = Depends(get_db)):
    usuarios = db.query(Usuario).all()
    # ...`,
        impact: "Una sesión por request, cierre garantizado, código más limpio. procesarAsistencia pasa de 4 sesiones a 1.",
      },
      {
        title: "Arreglar HuellaController singleton con sesión compartida",
        description:
          'La línea 80 de main.py crea huella_buffer = HuellaController(db=SessionLocal()) — una sesión que vive todo el ciclo de vida del servidor. Bajo requests concurrentes, esta sesión compartida puede corromperse (writes entrelazados, stale reads).',
        code: `# ANTES (main.py línea 80):
huella_buffer = HuellaController(db=SessionLocal())  # sesión ETERNA

# DESPUÉS — inyectar sesión fresca en cada operación:
class HuellaController:
    def procesar_contexto(self, contexto, controlador_hardware, 
                          id_alumno=None, db=None):
        # db viene del Depends(get_db) del endpoint`,
        impact: "Elimina un bug de concurrencia latente que podría corromper datos de huellas.",
      },
    ],
  },
  {
    day: "Martes",
    title: "Extraer lógica de main.py (777→~150 líneas)",
    priority: "ALTO",
    hours: "~5h",
    color: "#D85A30",
    tasks: [
      {
        title: "Separar modelos Pydantic → infra/schemas.py",
        description:
          "Los 6 modelos Pydantic (NuevoUsuario, EdicionHuella, ProcesarTicket, UpdateUser, VincularHuella) están mezclados entre los endpoints. Moverlos a su propio archivo.",
        files: ["infra/main.py líneas 97-119 → infra/schemas.py"],
        impact: "main.py pierde ~25 líneas, schemas reutilizables.",
      },
      {
        title: "Extraer lógica de negocio inlined en main.py",
        description:
          "main.py tiene funciones de negocio que no deberían estar ahí: _resolver_curso_id() (40 líneas de parsing de cursos), _generar_rut_provisional() (cálculo de dígito verificador), _seed_cursos(), y toda la lógica de crear_usuario_base_endpoint (50 líneas de upsert complejo).",
        files: [
          "_resolver_curso_id() → core/Services/cursoService.py",
          "_generar_rut_provisional() → core/Services/rutService.py (reusar RunService existente)",
          "_seed_cursos() → infra/DB/seeds.py",
          "crear_usuario_base_endpoint lógica → core/Services/usuarioService.py",
        ],
        impact: "main.py baja de 777 a ~150 líneas. Solo rutas y wiring.",
      },
      {
        title: "Extraer endpoints a routers de FastAPI",
        description:
          "Agrupar los endpoints en APIRouters temáticos en vez de tener todo en un solo archivo.",
        code: `# infra/routers/usuarios.py
from fastapi import APIRouter, Depends
router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])

@router.get("/")
def obtener_usuarios(db: Session = Depends(get_db)):
    ...

# main.py queda:
app.include_router(usuarios_router)
app.include_router(biometria_router)
app.include_router(registros_router)
app.include_router(exportacion_router)`,
        files: [
          "infra/routers/usuarios.py — CRUD usuarios + búsqueda",
          "infra/routers/biometria.py — enrolar, editar, identificar huellas",
          "infra/routers/registros.py — tickets, asistencia, historial",
          "infra/routers/exportacion.py — Excel import/export",
          "infra/routers/websockets.py — todos los WS endpoints",
        ],
        impact: "Cada archivo de ~50-80 líneas, fácil de navegar y testear.",
      },
    ],
  },
  {
    day: "Miércoles",
    title: "Eliminar duplicación + consolidar formato de curso",
    priority: "MEDIO",
    hours: "~3h",
    color: "#BA7517",
    tasks: [
      {
        title: 'Unificar la función "nombre_curso" (copy-pasteada 5+ veces)',
        description:
          'La misma lógica de formateo de curso está copiada en: main.py (líneas 264, 278, 314, 384, 41 de RegistrosController). Es la expresión: " ".join(p for p in [str(u.curso.numero) if u.curso.numero is not None else "", u.curso.nivel, u.curso.letra or ""] if p).strip())',
        code: `# infra/DB/modelos.py — agregar método al modelo:
class Curso(Base):
    ...
    @property
    def nombre_completo(self) -> str:
        partes = []
        if self.numero is not None:
            partes.append(str(self.numero))
        partes.append(self.nivel)
        if self.letra:
            partes.append(self.letra)
        return " ".join(partes)

# Uso: usuario.curso.nombre_completo en vez del inline de 3 líneas`,
        impact: "Eliminas 5 copias de la misma expresión. Un solo lugar para mantener.",
      },
      {
        title: "Consolidar procesarAsistencia (4 queries → 1)",
        description:
          "RegistrosController.procesarAsistencia() hace: validar_usuario (1 query), validar_usuario_pae (otra query al mismo usuario), obtener_datos_alumno (otra query al mismo usuario). Son 3 queries separadas + 3 sesiones para leer el mismo registro.",
        code: `# DESPUÉS:
def procesarAsistencia(self, usuario_id: int, db: Session):
    usuario = db.query(Usuario).filter(
        Usuario.id == usuario_id
    ).first()
    
    if not usuario:
        return {"estado": "Rechazado", "mensaje": "No encontrado"}
    if not usuario.es_pae:
        return {"estado": "Rechazado", "mensaje": "No PAE"}
    # ... todo con el mismo objeto, 1 query`,
        impact: "3x menos queries por cada acceso de tótem. Respuesta más rápida.",
      },
      {
        title: "Decidir destino de IdentificacionController",
        description:
          "Según tu PENDIENTES.md (punto 3): este controlador existe pero no está conectado a ningún endpoint. Los WebSockets ya hacen el mismo trabajo. Recomendación: eliminarlo.",
        impact: "Menos confusión, menos código muerto.",
      },
    ],
  },
  {
    day: "Jueves",
    title: "WebSockets: eliminar polling + mejorar flujos",
    priority: "MEDIO",
    hours: "~4h",
    color: "#1D9E75",
    tasks: [
      {
        title: "Deprecar el endpoint /api/huella/pooling",
        description:
          "El frontend llama a /api/huella/pooling cada 1 segundo para saber si el sensor terminó. Ya tienes 5 endpoints WebSocket que hacen push directo (ws/totem, ws/huella/identificar, etc). El polling es redundante y desperdicia requests.",
        impact: "Eliminas tráfico innecesario. El frontend ya usa los WS.",
      },
      {
        title: "Unificar patrón de WebSocket (DRY)",
        description:
          "Los 5 WebSocket endpoints (líneas 530-689 de main.py) repiten el mismo boilerplate: accept → inicializar sensor → limpiar buffer → run_in_executor → timeout → send_json. Extraer a una función helper.",
        code: `async def ws_with_sensor(websocket, task_fn, timeout=20.0):
    """Wrapper: acepta WS, inicializa sensor, ejecuta task con timeout."""
    await websocket.accept()
    try:
        exito, msg = hardware_service.inicializar()
        if not exito:
            await websocket.send_json({"estado": False, "mensaje": msg})
            return
        huella_buffer.limpiar()
        loop = asyncio.get_running_loop()
        try:
            resultado = await asyncio.wait_for(
                loop.run_in_executor(None, task_fn),
                timeout=timeout
            )
            await websocket.send_json(resultado)
        except asyncio.TimeoutError:
            await websocket.send_json({
                "estado": False, "mensaje": "Tiempo agotado"
            })
    except WebSocketDisconnect:
        pass

# Uso:
@app.websocket("/ws/huella/identificar")
async def ws_identificar(websocket: WebSocket):
    await ws_with_sensor(
        websocket, 
        hardware_service.identificar_usuario
    )`,
        impact: "De ~160 líneas de WS boilerplate a ~60. Menos bugs por copy-paste.",
      },
      {
        title: "Timeout en polling del frontend (PENDIENTES #2)",
        description:
          "Si mantienes el polling temporalmente: agregar timeout de 15 segundos en el frontend. El setInterval nunca se cancela.",
        impact: "Resuelve el bug crítico #2 de tu lista de pendientes.",
      },
    ],
  },
  {
    day: "Viernes",
    title: "Testing + documentación + ajustes finales",
    priority: "BAJO",
    hours: "~3h",
    color: "#534AB7",
    tasks: [
      {
        title: "Agregar tests básicos para los flujos críticos",
        description:
          "No hay tests en el proyecto. Crear al menos tests para: procesarAsistencia (happy path + rechazos), validación de RUT, resolución de curso, y el import de Excel.",
        code: `# tests/test_asistencia.py
import pytest
from unittest.mock import patch

def test_rechaza_usuario_no_pae(db_session):
    # Crear usuario sin PAE
    usuario = crear_usuario(es_pae=False)
    resultado = controller.procesarAsistencia(usuario.id, db_session)
    assert resultado["estado"] == "Rechazado"

def test_rechaza_ticket_duplicado(db_session):
    # Ya tiene ticket de hoy
    ...`,
        impact: "Red de seguridad mínima para que la refactorización no rompa nada.",
      },
      {
        title: "Actualizar estructura de carpetas",
        description:
          "Después de la limpieza, la estructura debería verse así:",
        code: `BioPae/
├── core/
│   └── Services/
│       ├── cursoService.py      # _resolver_curso_id extraído
│       ├── rutService.py        # RunService limpio
│       ├── horarioService.py    # sin cambios
│       └── usuarioService.py    # lógica de upsert extraída
├── infra/
│   ├── DB/
│   │   ├── modelos.py           # + property nombre_completo en Curso
│   │   └── seeds.py             # _seed_cursos extraído
│   ├── Controller/
│   │   └── huellaController.py  # con sesión inyectada
│   ├── dependencies.py          # get_db()
│   ├── schemas.py               # modelos Pydantic
│   ├── routers/
│   │   ├── usuarios.py
│   │   ├── biometria.py
│   │   ├── registros.py
│   │   ├── exportacion.py
│   │   └── websockets.py
│   ├── Hardware/                 # sin cambios (C++)
│   └── main.py                  # ~80 líneas: app + routers + lifespan
├── tests/
│   ├── test_asistencia.py
│   └── test_rut.py
└── Frontend/`,
        impact: "Proyecto navegable, cada archivo con responsabilidad clara.",
      },
      {
        title: "Actualizar PENDIENTES.md",
        description:
          "Marcar los puntos resueltos (#1 ya corregido en el código actual, #5 ya corregido, #6 ya corregido). Actualizar con los nuevos items que surjan de la refactorización.",
        impact: "Documentación al día para el equipo.",
      },
    ],
  },
];

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      style={{
        background: "var(--color-background-secondary)",
        borderRadius: 8,
        padding: "12px 16px",
        marginTop: 8,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        lineHeight: 1.6,
        overflowX: "auto",
        position: "relative",
        border: "1px solid var(--color-border-tertiary)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "var(--color-background-tertiary)",
          border: "1px solid var(--color-border-tertiary)",
          borderRadius: 4,
          padding: "2px 8px",
          fontSize: 11,
          cursor: "pointer",
          color: "var(--color-text-secondary)",
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
      {code}
    </div>
  );
}

export default function PlanRefactorizacion() {
  const [openDay, setOpenDay] = useState(0);
  const [checked, setChecked] = useState({});

  const toggle = (dayIdx, taskIdx) => {
    const key = `${dayIdx}-${taskIdx}`;
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalTasks = DAYS.reduce((sum, d) => sum + d.tasks.length, 0);
  const completedTasks = Object.values(checked).filter(Boolean).length;
  const progress = Math.round((completedTasks / totalTasks) * 100);

  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        color: "var(--color-text-primary)",
        maxWidth: 720,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>
          Plan de refactorización BioPae
        </h2>
        <span
          style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
        >
          {completedTasks}/{totalTasks} tareas
        </span>
      </div>

      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary)",
          margin: "0 0 16px",
        }}
      >
        Lunes 14 → Viernes 18 de abril 2026
      </p>

      <div
        style={{
          height: 6,
          background: "var(--color-background-secondary)",
          borderRadius: 3,
          marginBottom: 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background:
              progress === 100
                ? "var(--color-text-success)"
                : "var(--color-text-info)",
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {DAYS.map((day, dayIdx) => {
        const isOpen = openDay === dayIdx;
        const dayCompleted = day.tasks.every(
          (_, ti) => checked[`${dayIdx}-${ti}`]
        );

        return (
          <div
            key={dayIdx}
            style={{
              border: "1px solid var(--color-border-tertiary)",
              borderRadius: 12,
              marginBottom: 10,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setOpenDay(isOpen ? -1 : dayIdx)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--color-text-primary)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: dayCompleted
                    ? "var(--color-text-success)"
                    : day.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    textDecoration: dayCompleted ? "line-through" : "none",
                    opacity: dayCompleted ? 0.5 : 1,
                  }}
                >
                  {day.day}: {day.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    marginTop: 2,
                  }}
                >
                  {day.hours} estimadas · {day.tasks.length} tareas ·{" "}
                  {day.priority}
                </div>
              </div>
              <span
                style={{
                  fontSize: 18,
                  color: "var(--color-text-tertiary)",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0)",
                  transition: "transform 0.2s",
                }}
              >
                ▾
              </span>
            </button>

            {isOpen && (
              <div
                style={{
                  padding: "0 16px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {day.tasks.map((task, taskIdx) => {
                  const key = `${dayIdx}-${taskIdx}`;
                  const done = checked[key];
                  return (
                    <div
                      key={taskIdx}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        background: "var(--color-background-secondary)",
                        opacity: done ? 0.55 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!done}
                          onChange={() => toggle(dayIdx, taskIdx)}
                          style={{
                            marginTop: 3,
                            width: 16,
                            height: 16,
                            flexShrink: 0,
                            accentColor: "var(--color-text-info)",
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              textDecoration: done
                                ? "line-through"
                                : "none",
                            }}
                          >
                            {task.title}
                          </div>
                          <p
                            style={{
                              fontSize: 13,
                              color: "var(--color-text-secondary)",
                              margin: "6px 0 0",
                              lineHeight: 1.6,
                            }}
                          >
                            {task.description}
                          </p>
                        </div>
                      </label>

                      {task.files && (
                        <div style={{ marginTop: 10, paddingLeft: 26 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "var(--color-text-secondary)",
                              marginBottom: 4,
                            }}
                          >
                            Archivos afectados:
                          </div>
                          {task.files.map((f, i) => (
                            <div
                              key={i}
                              style={{
                                fontSize: 12,
                                fontFamily: "var(--font-mono)",
                                color: "var(--color-text-secondary)",
                                padding: "2px 0",
                                lineHeight: 1.5,
                              }}
                            >
                              → {f}
                            </div>
                          ))}
                        </div>
                      )}

                      {task.code && (
                        <div style={{ marginTop: 10, paddingLeft: 26 }}>
                          <CodeBlock code={task.code} />
                        </div>
                      )}

                      {task.impact && (
                        <div
                          style={{
                            marginTop: 10,
                            paddingLeft: 26,
                            fontSize: 12,
                            color: "var(--color-text-success)",
                            fontWeight: 500,
                          }}
                        >
                          ✓ {task.impact}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div
        style={{
          marginTop: 20,
          padding: 14,
          borderRadius: 10,
          border: "1px solid var(--color-border-info)",
          background: "var(--color-background-info)",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--color-text-info)",
        }}
      >
        <strong>Sobre migrar a C:</strong> La parte CPU-intensive (biometría) ya
        está en C++ vía pybind11. El resto es I/O-bound (SQLite, HTTP,
        WebSockets) donde C no aporta mejora medible. La refactorización del
        Python te dará mejor rendimiento (menos queries, menos sesiones) que
        cualquier rewrite en C.
      </div>
    </div>
  );
}
