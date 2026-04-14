╔══════════════════════════════════════════════════════════════════╗  
║                    TÓTEM \- FLUJO PRINCIPAL                       ║  
╚══════════════════════════════════════════════════════════════════╝

\[Estudiante pone el dedo\]  
         │  
         ▼  
  ┌─────────────────┐     ┌──────────────────────────────────────┐  
  │  ws/totem       │     │  Botón "Registrarse"                 │  
  │  (ticket flow)  │     │  iniciarRegistro()                   │  
  └────────┬────────┘     └──────────────┬───────────────────────┘  
           │                             │  
           ▼                             ▼  
   ¿Reconocida?              ws/huella/capturar-identificar  
    /         \\                          │  
  NO           SÍ                ¿Reconocida?  
   │            │                /           \\  
   │            ▼              SÍ             NO  
   │      procesarAsistencia    │              │  
   │            │               ▼              ▼  
   │      ¿es\_pae?        "Ya registrado"   Formulario  
   │       /     \\         ¿Actualizar?   nombre+RUT+curso  
   │     NO      SÍ        /        \\  
   │      │       │      SÍ         NO        
   │   Rechazado  │       │       Cancelar    
   │              │  ws/huella/editar          
   │        ¿Ya recibió                       
   │         ticket hoy?                      
   │          /      \\                        
   │        SÍ        NO                     
   │         │         │                     
   │      Rechazado  Aprobado ✓              
   │      (pantalla verde)                    
   │  
   └── Rechazado "Huella no reconocida"

╔══════════════════════════════════════════════════════════════════╗  
║              FORMULARIO \- handleEnrollForm()                     ║  
╚══════════════════════════════════════════════════════════════════╝

\[nombre \+ RUT(opcional) \+ curso\]  
         │  
         ▼  
  ¿RUT ingresado inválido?  
    SÍ → mostrar error inline, detener  
    NO → continuar  
         │  
         ▼  
  GET /api/usuarios/buscar?nombre=...  
  → filtrar por curso seleccionado  
         │  
    ¿candidatos?  
    /           \\  
  NO            SÍ  
   │             │  
   │    ¿tienen huella?  
   │    /              \\  
   │  TODOS            ALGUNO sin huella  
   │   SÍ               │  
   │    │               ▼  
   │  BLOQUEADO    mostrarConfirmacion(sinHuella)  
   │  "ya tienes        │  
   │   huella"          ▼  
   │             estudiante se selecciona  
   │                    │  
   ▼                    ▼  
POST /api/usuarios/base    confirmarYEnrolar(id, nombre, rut\_en\_bd)

╔══════════════════════════════════════════════════════════════════╗  
║           BACKEND \- POST /api/usuarios/base                      ║  
╚══════════════════════════════════════════════════════════════════╝

         │  
         ▼  
  ¿Existe por nombre+curso?  
    SÍ → existente\_por\_nombre \= ese usuario  
    NO → existente\_por\_nombre \= null  
         │  
         ▼  
  ¿RUT ingresado? → ¿Existe ese RUT en BD?  
    NO RUT → existente\_por\_rut \= null  
    SÍ RUT:  
      ¿pertenece a DISTINTO estudiante que existente\_por\_nombre?  
        SÍ → 409 CONFLICT ← ─ ─ frontend muestra "RUT de otro estudiante"  
        NO → continuar  
         │  
         ▼  
  ¿existente (por nombre o por rut)?  
    SÍ → ACTUALIZAR: curso\_id, estado\_id, rut(si vino), es\_pae(solo sube)  
         → return { id, duplicado: true }  
    NO → CREAR NUEVO  
         rut \= rut\_ingresado  ← si el estudiante lo ingresó  
               ó  
         rut \= \_generar\_rut\_provisional()  ← si no ingresó RUT  
         → return { id, duplicado: false }

╔══════════════════════════════════════════════════════════════════╗  
║           FRONTEND \- confirmarYEnrolar(id, nombre, existingRut)  ║  
╚══════════════════════════════════════════════════════════════════╝

         │  
         ▼  
  ¿enrollRutIngresado (usuario escribió RUT)?  
    SÍ:  
      ¿existingRut en BD Y es distinto?  
        SÍ → mostrar advertencia "¿Sobrescribir RUT?" → confirmar/cancelar  
        NO:  
          ¿existingRut es null? → PUT actualizar RUT al ingresado  
          ¿existingRut igual? → no hacer nada  
    NO:  
      ¿existingRut en BD?  
        SÍ → no hacer nada (conservar RUT real)  
        NO → generar provisional → PUT actualizar RUT  
         │  
         ▼  
  \_procederEnrolamiento(id, nombre)  
         │  
         ▼  
  ¿capturedHuellaHex (huella del primer scan)?  
    SÍ → POST /api/huella/vincular  ← más rápido, sin segundo scan  
    NO → ws/huella/enrolar/{id}     ← segundo scan requerido  
         │  
         ▼  
       ✓ Huella registrada \- "¡Bienvenido\!"

