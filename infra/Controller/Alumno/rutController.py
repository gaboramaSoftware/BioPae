#controllador para el rut del alumno, se encarga de validar el rut y pasarselo al servicio para que lo guarde en la base de datos del sistema
from core.Services.userServces.Usuario.alumnoService import AlumnoService, Alumno
from core.Services.userServces.Atributos.nombreService import NombreService
from core.Services.userServces.Atributos.RunService import RunService

class RutController:
    #procesar registro de rut del alumno, recibe el rut y el id del alumno para actualizar su rut en la base de datos
    def __init__(self):
        self.rutservice = RunService()
        self.alumno_service = AlumnoService()

    def procesar_registro_rut(self, rut_input: str, id_usuario: int):
        #validamos el rut
        if not self.rutservice.validarRun(rut_input):
            return {"status_code": 400, "error": "Rut inválido"}
        
        #obtenemos el rut limpio
        rut_limpio = self.rutservice.obtenerRun(rut_input)
        
        #actualizamos el rut del alumno en la base de datos
        resultado = self.alumno_service.actualizar_rut_alumno(id_usuario, rut_limpio)
        
        if not resultado["estado"]:
            return {"status_code": 500, "error": resultado["mensaje"]}
        
        return {"status_code": 200, "mensaje": "Rut actualizado correctamente", "data": {"rut": rut_limpio}}
    
    def calcular_dv(self, rut_input: str):
        rut_limpio = self.rutservice.obtenerRun(rut_input)
        dv_calculado = self.rutservice.algoritmoM11(rut_limpio)
        return {"status_code": 200, "data": {"dv_calculado": dv_calculado}}