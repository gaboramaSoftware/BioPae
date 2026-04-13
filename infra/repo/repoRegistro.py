#repositorio del registro del estudiante, se encarga de registrar el acceso del estudiante al comedor
#el registro sirve para tener constancia de que alumnos ingresaron
from datetime import datetime
from infra.DB.modelos import SessionLocal
from infra.DB.modelos import Registro

class RegistroRepository:
    def __init__(self):
        self.db = SessionLocal()

    def crear_registro(self, usuario_id: int, totem_id: int, estado_registro: str, tipo_solicitud: str):
        nuevo_registro = Registro(
            usuario_id=usuario_id,
            totem_id=totem_id,
            fecha=datetime.now().date(),
            hora=datetime.now().time(),
            estado_registro=estado_registro,
            tipo_solicitud=tipo_solicitud
        )
        self.db.add(nuevo_registro)
        self.db.commit()
        self.db.refresh(nuevo_registro)
        return nuevo_registro
    
    def obtener_registros(self, usuario_id: int):
        #TODO: manejar la cantidad de datos que se piden, paginación, etc
        return self.db.query(Registro).filter(Registro.usuario_id == usuario_id).all()
    
    def eliminar_registros(self, usuario_id):
        self.db.query(Registro).filter(Registro.usuario_id == usuario_id).delete()
        self.db.commit()
    