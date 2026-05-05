#logica de negocio de los registros, se encarga de registrar el acceso del estudiante al comedor
#el registro sirve para tener constancia de que alumnos ingresaron
from datetime import datetime
from infra.repo.repoRegistro import RegistroRepository

class RegistroService:
    def __init__(self):
        self.registro_repo = RegistroRepository()

    def capturar_registro(self, usuario_id: int, totem_id: int, estado_registro: str, tipo_solicitud: str):
         return self.crear_registro(usuario_id, totem_id, estado_registro, tipo_solicitud)
    
    def capturar_horario_ticket(self):
        #Funcion para registrar la fecha y la hora del ticket para saber si es desayuno o almuerzo
        now = datetime.now()

        #TODO mover esto a ticketService 
        match now.hour:
            case h if 8 <= h < 12:
                return "desayuno"
            case h if 12 <= h < 24:
                return "almuerzo"
            case _:
                return "fuera de horario"

    def crear_registro(self, usuario_id: int, totem_id: int, estado_registro: str, tipo_solicitud: str):
        return self.registro_repo.crear_registro(usuario_id, totem_id, estado_registro, tipo_solicitud)
    
    def obtener_registros(self, usuario_id: int):
        return self.registro_repo.obtener_registros(usuario_id)
    
    def eliminar_registros(self, usuario_id):
        self.registro_repo.eliminar_registros(usuario_id)