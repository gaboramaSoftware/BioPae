# Pendientes del Sistema — Pydigitador
> Estado al 30/04/2026. Revisión completa antes de presentación beta.

---

## RESUELTO ✅ — Corregido y verificado

| # | Qué | Archivo |
|---|-----|---------|
| 1 | Guardar huella en SQLite al enrolar/editar | `huellaController.py` |
| 2 | Polling sin timeout → reemplazado por WebSocket | `renderer.js` |
| 3 | `IdentificacionController` eliminado (Opción B) | — |
| 4 | Parámetro `tipo_solicitud` huérfano eliminado | — |
| 5 | SQLAlchemy 2.0: `db.execute(text("SELECT 1"))` | `main.py:307` |
| 6 | `totem_id` ahora configurable por env var `TOTEM_ID` | `main.py:251` |
| 9 | Capitalizar tipo_racion en frontend | `renderer.js:81` |
| — | Error de sintaxis `Ñ` en `registroService.py:33` | `registroService.py` |

---

## FALTANTE — No construido (fuera del alcance beta)

### 7. Mensaje de registro cuando el estudiante no existe
El flujo devuelve `"Usuario no encontrado en el sistema"` y termina.
- Flujo completo de auto-registro desde el tótem (punto 8) no construido.

### 10. Botón reintentar en error de conexión
Si los 15 intentos de conexión inicial fallan, no hay botón para reintentar sin recargar la app.

---

## BETA — Limitaciones conocidas aceptadas

- Credenciales admin por defecto: RUT `11111111` / contraseña `admin123` (cambiar en producción real)
- Base de datos sin cifrar
- Sin autenticación en endpoints de API (aceptable para red local cerrada)
- Servidor expuesto en `0.0.0.0:8080` (agregar firewall en producción real)
