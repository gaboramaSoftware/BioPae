#controlador del curso del alumno, se encargara de recibir los datos del curso el grado y la letra del curso, validarlos y pasarselos al servicio para que los guarde en la base de datos del sistema
from core.Services.userServces.Usuario.alumnoService import AlumnoService, Alumno
from core.Services.userServces.Atributos.nombreService import NombreService
from core.Services.userServces.Atributos.CursoService import CursoService

class CursoController:
    def __init__(self):
        self.curso_service = CursoService()
        self.alumno_service = AlumnoService()

    def procesar_registro_curso(self, curso_input: str, id_usuario: int):
        try:
            curso_limpio = self.curso_service.obtener_curso(curso_input)
        except ValueError as e:
            return {"status_code": 400, "error": str(e)}
        
        resultado = self.alumno_service.actualizar_curso_alumno(id_usuario, curso_limpio)
        
        if not resultado["estado"]:
            return {"status_code": 500, "error": resultado["mensaje"]}
        
        return {"status_code": 200, "mensaje": "Curso actualizado correctamente", "data": {"curso": curso_limpio}}
    
    def obtener_curso_alumno(self, id_usuario: int):
        perfil = self.curso_service.obtener_curso_alumno(id_usuario)
        
        if not perfil:
            return {"status_code": 404, "error": "Alumno no encontrado"}
            
        return {"status_code": 200, "data": perfil}