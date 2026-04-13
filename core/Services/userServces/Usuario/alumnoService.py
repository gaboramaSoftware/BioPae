#este archivo toma todos los datos antes generados por el sistema y los transforma en objeto alumno para pasarselos al repositorio
from infra.Controller.huella.huellaController import huellaCoontroller
from core.Services.userServces.Atributos.nombreService import NombreService, nombre_final, apellido_paterno_final, apellido_materno_final
from core.Domain.Repository.alumnosRepository import AlumnosRepository
from core.Services.userServces.Atributos.RunService import RunService, MandarRunCompleto, run_validado

class Alumno:
    def __init__(self, id_usuario: int, nombre: str, apellido_paterno: str, apellido_materno: str, huella: bytes):
        self.id_usuario = id_usuario
        self.nombre = nombre
        self.apellido_paterno = apellido_paterno
        self.apellido_materno = apellido_materno
        self.run = run_validado

class AlumnoService:
    def __init__(self):
        self.huella_controller = huellaCoontroller()

    def crear_alumno(self, id_usuario: int, nombre: str, apellido_paterno: str, apellido_materno: str) -> Alumno | None:
        exito, huella_bytes = self.huella_controller.capturar_plantilla()
        if not exito or huella_bytes is None:
            return None
        return Alumno(id_usuario, nombre, apellido_paterno, apellido_materno, huella_bytes)
