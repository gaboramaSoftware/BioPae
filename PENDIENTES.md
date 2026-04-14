# Pendientes del Sistema — Pydigitador
> Estado al 02/04/2026. Generado tras revisión completa del flujo de datos.

---

## Contexto: Flujo esperado

```
Huella → Identificar → Validar existencia → Validar PAE → Validar double-dip → Emitir ticket
```

Todo lo que está en este documento impide o degrada alguna de estas fases.

---

## CRÍTICO — Rompe el flujo completamente

### 1. Enrolamiento no guarda huella en SQLite
**Archivo:** `infra/Controller/Alumno/huellaController.py` — caso `"enrolar"` (línea 56)

El enrolamiento guarda la plantilla solo en la DB interna del sensor ZKTeco.
La tabla `Huella` en SQLite (`huella_blob`) nunca se popula.

**Consecuencia:** Si el sensor se resetea, se cambia de hardware o se pierde energía,
todas las huellas enroladas se pierden y no hay forma de recuperarlas.

**Lo que falta construir:**
- Después de `guardar_en_bd(id_alumno, huella_bytes)`, guardar también en SQLite:
  crear o actualizar el registro en la tabla `Huella` con `huella_blob = huella_bytes.hex()`
- Mismo fix aplica para el caso `"editar"`

---

### 2. Polling del frontend no tiene timeout
**Archivo:** `Frontend/src/js/renderer.js` — función `activarSensor()` (línea 75)

El `setInterval` que consulta `/api/huella/pooling` nunca se cancela por tiempo.
Si el sensor no detecta ningún dedo (error de hardware, dedo mal puesto), la UI
queda en pantalla "Procesando..." para siempre.

**Lo que falta construir:**
- Agregar un timeout de ~15 segundos al polling
- Si se cumple el tiempo sin respuesta: cancelar interval y llamar `activarSensor()` para volver a espera

---

## MEDIO — Comportamiento incorrecto pero no bloquea el flujo feliz

### 3. `IdentificacionController` existe pero no está conectado a ningún endpoint
**Archivo:** `infra/Controller/huella/identificacionController.py`

Este controlador fue construido como una versión unificada del flujo (capture + identify + ticket en un solo paso).
Fue corregido en la sesión de hoy, pero **ningún endpoint en `main.py` lo invoca**.

El flujo real usa: `HuellaController` (buffer) → polling → `/api/ticket/procesar` → `RegistrosController`.

**Lo que falta decidir y hacer:**
- Opción A: Conectar `IdentificacionController` a un nuevo endpoint `/api/totem/procesar`
  que reemplace los 3 pasos actuales (acceso + polling + ticket) en una sola llamada
- Opción B: Eliminar `IdentificacionController` para evitar confusión y mantener el flujo de 3 pasos

---

### 4. Parámetro `tipo_solicitud` huérfano en `IdentificacionController`
**Archivo:** `infra/Controller/huella/identificacionController.py` — línea 10

```python
def procesar_acceso(self, tipo_solicitud: str):  # ← este parámetro ya no se usa
```

Después de la corrección de hoy, `procesarAsistencia` determina el tipo de ración
internamente desde `obtener_tipo_racion()`. El parámetro quedó sin uso.

**Lo que falta:** Eliminar el parámetro de la firma del método.

---

### 5. Incompatibilidad SQLAlchemy 2.0 en `/api/db/status`
**Archivo:** `infra/main.py` — línea 68

```python
db.execute("SELECT 1")  # ← falla en SQLAlchemy 2.0+
```

En SQLAlchemy 2.0 las queries en texto plano requieren `text()`.

**Lo que falta:**
```python
from sqlalchemy import text
db.execute(text("SELECT 1"))
```

---

### 6. `totem_id` hardcodeado como `1`
**Archivo:** `infra/main.py` — línea 29

```python
registros_controller = RegistrosController(totem_id=1)  # ← hardcoded
```

Todos los registros y tickets quedan asociados al Totem 1 sin importar desde
qué dispositivo se generen.

**Lo que falta:**
- Definir `totem_id` desde una variable de entorno o archivo de configuración al iniciar el servidor
- Ejemplo: `TOTEM_ID=2 python infra/main.py`

---

## FALTANTE — Funcionalidad descrita en el flujo pero no construida

### 7. Mensaje de registro cuando el estudiante no existe
**Archivo:** `infra/Controller/RegistrosController.py` — línea 50

El flujo original especifica:
> "SI NO está registrado: mostrar '¿Desea iniciar el proceso de registro?'"

Hoy el sistema devuelve `"Usuario no encontrado en el sistema"` y termina.

**Lo que falta:**
- Cambiar el mensaje de rechazo para ese caso a: `"Usuario no encontrado. ¿Desea iniciar el proceso de registro?"`
- En el frontend: cuando el status es `"rejected"` y el mensaje contiene "registro",
  mostrar un botón que active el flujo de enrolamiento desde el tótem

---

### 8. Flujo de auto-registro desde el tótem
Relacionado con el punto 7. No existe ningún flujo que permita al estudiante
iniciar su propio registro al no ser reconocido.

**Lo que falta construir:**
- Pantalla de formulario básico en el tótem (nombre, RUT, curso)
- Botón "Registrar huella" que llame a `/api/huella/enrolar` con los datos ingresados
- Validación de RUT duplicado antes de crear el usuario
- Confirmación visual al terminar el enrolamiento

---

## FRONTEND — Detalles menores

### 9. Texto de ración sin capitalizar
**Archivo:** `Frontend/src/js/renderer.js` — función `mostrarAprobado` (línea 39)

El campo `tipo_racion` muestra `"desayuno"` o `"almuerzo"` en minúsculas directamente del backend.

**Lo que falta:** Capitalizar en el frontend antes de mostrar:
```javascript
data?.tipo_racion?.charAt(0).toUpperCase() + data?.tipo_racion?.slice(1)
```

---

### 10. Sin reintentos si el servidor no responde al iniciar
**Archivo:** `Frontend/src/js/renderer.js` — función `inicializar()` (línea 128)

Si los 30 intentos de conexión fallan, se muestra error y la UI queda bloqueada.
No hay botón ni forma de reintentar sin recargar la aplicación.

**Lo que falta:** Agregar un botón "Reintentar" visible en la pantalla de error de conexión.

---

## Resumen de prioridades

| # | Qué | Prioridad | Archivo |
|---|-----|-----------|---------|
| 1 | Guardar huella en SQLite al enrolar | CRÍTICO | `huellaController.py` |
| 2 | Timeout al polling del frontend | CRÍTICO | `renderer.js` |
| 3 | Decidir destino de `IdentificacionController` | MEDIO | `identificacionController.py` / `main.py` |
| 4 | Eliminar parámetro `tipo_solicitud` huérfano | MEDIO | `identificacionController.py` |
| 5 | Fix SQLAlchemy 2.0 en db/status | MEDIO | `main.py` |
| 6 | `totem_id` configurable | MEDIO | `main.py` |
| 7 | Mensaje "¿Desea registrarse?" + botón | FALTANTE | `RegistrosController.py` + `renderer.js` |
| 8 | Flujo de auto-registro desde tótem | FALTANTE | nuevo endpoint + frontend |
| 9 | Capitalizar texto de ración | MENOR | `renderer.js` |
| 10 | Botón reintentar en error de conexión | MENOR | `renderer.js` |

---

## Lo que quedó corregido en esta sesión

| Fix | Archivos modificados |
|-----|---------------------|
| Doble captura de huella (dedo x2) | `identificacionController.py` |
| TypeError en `identificar_usuario(huella_bytes)` | `identificacionController.py` |
| Código muerto (segundo `if user_id == -1`) | `identificacionController.py` |
| Sensor cerrado con `finally` después de cada scan | `identificacionController.py` |
| Signature mismatch `procesarAsistencia(user_id, tipo_solicitud)` | `identificacionController.py` |
| FK violation al registrar usuario inexistente | `RegistrosController.py` |
| Auditoría creada 4 veces en distintos puntos | `RegistrosController.py` |
| `tipo_racion` en `frontend_data` tomado del resultado | `identificacionController.py` |
