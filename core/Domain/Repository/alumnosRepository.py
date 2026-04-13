#repositorio de alumnos para guardar los objetos ALUMNO en la base de datos del sistema
from infra.DB.modelos import Usuario, EstadoEstudiante, Huella, Curso, Totem, Registro
"C:\Proyectos\Pydigitador\core\Services\userServces\Usuario\alumnoService.py"
from core.Services.userServces.Usuario.alumnoService import AlumnoService, Alumno
from infra.Controller.huella.huellaController import huellaCoontroller
from sqlalchemy.orm import Session

class AlumnosRepository:
    def __init__(self):
        pass
    
    #guardamos el objeto Alumno en la base de datos del sistema
    def guardar_alumno(self, alumno) -> bool:
        #capturamos los datos fundamentales de el objeto alumno (de momento vamos a usar 2)
        id_usuario = alumno.id_usuario
        huella = alumno.huella

        #creamos una instancia de la sesión de la base de datos
        session = Session()
        #creamos un nuevo registro de usuario en la base de datos
        nuevo_usuario = Usuario(id=id_usuario)
        session.add(nuevo_usuario)
        session.commit()

        return True
    
    #como hago para eventualmente editar los datos del alumno?
    def editar_alumno(self, alumno) -> bool:
        #capturamos los datos fundamentales de el objeto alumno (de momento vamos a usar 2)
        id_usuario = alumno.id_usuario
        huella = alumno.huella

        #creamos una instancia de la sesión de la base de datos
        session = Session()
        #buscamos el usuario por su id y editamos sus datos
        usuario = session.query(Usuario).filter_by(id=id_usuario).first()
        if usuario:
            usuario.huella = huella
            session.commit()
            return True
        return False
    
    #eliminar alumno
    def eliminar_alumno(self, id_usuario: int) -> bool:
        #creamos una instancia de la sesión de la base de datos
        session = Session()
        #buscamos el usuario por su id y lo eliminamos
        usuario = session.query(Usuario).filter_by(id=id_usuario).first()
        if usuario:
            session.delete(usuario)
            session.commit()
            return True
        return False