from sqlalchemy.orm import sessionmaker
from infra.DB.modelos import Base, Usuario, Huella, Registro, Ticket
from .IniciarDB import iniciarDB

engine = iniciarDB()
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def crearUsuarioBase(nombre: str, rut: str, curso_id: int, estado_id: int, es_pae: bool = False):
    db = SessionLocal()
    try:
        nuevo_usuario = Usuario(
            nombre=nombre,
            rut=rut,
            curso_id=curso_id,
            estado_id=estado_id,
            es_pae=es_pae
        )
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)
        return nuevo_usuario
    except Exception as e:
        db.rollback()
        print(f"Error al crear usuario base: {e}")
        return None
    finally:
        db.close()

def vincularRut(usuario_id: int, rut: str):
    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        if usuario:
            usuario.rut = rut
            db.commit()
            return True
        return False
    except Exception as e:
        db.rollback()
        return False
    finally:
        db.close()

def registrarHuella(usuario_id: int, huella_datos: bytes):
    db = SessionLocal()
    try:
        huella_existente = db.query(Huella).filter(Huella.usuario_id == usuario_id).first()
        if huella_existente:
            huella_existente.huella_blob = huella_datos.hex()
        else:
            db.add(Huella(huella_blob=huella_datos.hex(), usuario_id=usuario_id))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error al registrar huella: {e}")
        return False
    finally:
        db.close()

def guardarNuevoUsuario(nombre: str, rut: str, curso_id: int, estado_id: int, huella_datos: bytes, es_pae: bool = False):
    db = SessionLocal()
    try:
        usuario = crearUsuarioBase(nombre, rut, curso_id, estado_id, es_pae)
        if usuario is None:
            return None
        exito = registrarHuella(usuario.id, huella_datos)
        if not exito:
            eliminarUsuario(usuario.id)
            return None
        return usuario
    finally:
        db.close()

def editarUsuario(usuario_id: int, **kwargs):
    campos_permitidos = {"nombre", "rut", "curso_id", "estado_id", "es_pae"}
    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        if not usuario:
            return False
        for campo, valor in kwargs.items():
            if campo in campos_permitidos:
                setattr(usuario, campo, valor)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error al editar usuario: {e}")
        return False
    finally:
        db.close()

def eliminarUsuario(usuario_id: int):
    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        if not usuario:
            return False
        # Borrar tickets ligados a registros del usuario (FK: tickets.registro_id → registros.id)
        registro_ids = db.query(Registro.id).filter(Registro.usuario_id == usuario_id).all()
        registro_ids = [r[0] for r in registro_ids]
        if registro_ids:
            db.query(Ticket).filter(Ticket.registro_id.in_(registro_ids)).delete(synchronize_session=False)
        # Borrar tickets directos del usuario
        db.query(Ticket).filter(Ticket.usuario_id == usuario_id).delete(synchronize_session=False)
        # Borrar registros (sin cargar objetos — evita validación del enum corrupto)
        db.query(Registro).filter(Registro.usuario_id == usuario_id).delete(synchronize_session=False)
        db.delete(usuario)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error al eliminar usuario: {e}")
        return False
    finally:
        db.close()

