# infra/Controller/Usuario/nombreController.py
from core.Services.userServces.Usuario.nombreService import NombreService
from core.Services.userServces.Usuario.alumnoService import AlumnoService

class NombreController:
    def __init__(self): 
        self.nombre_service = NombreService()
        self.alumno_service = AlumnoService()


    def procesar_registro_nombres(self, nombres_input: str, paterno_input: str, materno_input: str):
        """
        Simula un endpoint que recibe datos del usuario y los limpia.
        """
        resultado = self.nombre_service.limpiar_nombres(nombres_input, paterno_input, materno_input)
        
        if not resultado["estado"]:
            # Devolvemos un error 400 (Bad Request)
            return {"status_code": 400, "error": resultado["mensaje"]}
        
        datos_procesados = resultado["datos_limpios"]
        
        # Si quisieras separar el primer nombre de los otros:
        nombres_separados = self.nombre_service.separar_nombres_manual(datos_procesados["nombres"])
        
        return {
            "status_code": 200, 
            "mensaje": "Procesado correctamente",
            "data": {
                "nombres_formateados": nombres_separados,
                "apellidos": f"{datos_procesados['apellido_paterno']} {datos_procesados['apellido_materno']}"
            }
        }

    def obtener_nombres_alumno(self, id_usuario: int):
        """
        Simula un endpoint GET para traer los nombres de un alumno.
        """
        perfil = self.nombre_service.obtener_perfil_nombres(id_usuario)
        
        if not perfil:
            return {"status_code": 404, "error": "Alumno no encontrado"}
            
        return {"status_code": 200, "data": perfil}