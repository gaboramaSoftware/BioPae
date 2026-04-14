from datetime import datetime
from infra.DB.modelos import Registro, Ticket
from core.Domain.Repository.UserRepository import SessionLocal

def crear_registro_evento(usuario_id: int, totem_id: int, estado: str, tipo: str):
    """Guarda CUALQUIER intento de uso del sistema."""
    db = SessionLocal()
    ahora = datetime.now()
    try:
        nuevo_res = Registro(
            usuario_id=usuario_id,
            totem_id=totem_id,
            fecha=ahora.date(),
            hora=ahora.time(),
            estado_registro=estado, # "Aprobado" o "Rechazado"
            tipo_solicitud=tipo    # "desayuno" o "almuerzo"
        )
        db.add(nuevo_res)
        db.commit()
        db.refresh(nuevo_res)
        return nuevo_res
    except Exception as e:
        db.rollback()
        print(f"Error al grabar registro base: {e}")
        return None
    finally:
        db.close()

def generar_ticket_comida(registro_id: int, usuario_id: int, tipo: str):
    """Genera el ticket oficial para JUNAEB."""
    db = SessionLocal()
    ahora = datetime.now()
    try:
        nuevo_ticket = Ticket(
            usuario_id=usuario_id,
            registro_id=registro_id,
            tipo_ticket=tipo,
            fecha_emision=ahora.date(),
            hora_emision=ahora.time()
        )
        db.add(nuevo_ticket)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error al emitir ticket: {e}")
        return False
    finally:
        db.close()

def ya_recibio_ticket_hoy(usuario_id: int, tipo: str):
    """Verifica si el usuario ya comió hoy su desayuno/almuerzo."""
    db = SessionLocal()
    hoy = datetime.now().date()
    try:
        existente = db.query(Ticket).filter(
            Ticket.usuario_id == usuario_id,
            Ticket.fecha_emision == hoy,
            Ticket.tipo_ticket == tipo
        ).first()
        return existente is not None
    except Exception as e:
        print(f"Error al consultar ticket de hoy: {e}")
        return True # Asumimos true para evitar emisión doble si hay error
    finally:
        db.close()
