# C:\Proyectos\Pydigitador\infra\Controller\Alumno\huellaController.py

from typing import Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session 
from infra.DB.modelos import Huella

class HuellaController:
    def __init__(self, db: Session): # Inyectamos la DB al iniciar
        self.db = db
        self.instancia: Optional[Any] = None
        self.huella_bytes: Optional[bytes] = None
        self.contexto: str = ""
        self.timestamp: Optional[datetime] = None

    def guardar_captura(self, instancia: Any, huella_bytes: Optional[bytes], contexto: str):
        self.instancia = instancia
        self.huella_bytes = huella_bytes
        self.contexto = contexto
        self.timestamp = datetime.now()

    def obtener_datos(self) -> dict:
        hay_datos = self.instancia is not None or self.huella_bytes is not None
        return {
            "hay_datos": hay_datos,
            "instancia": self.instancia,
            "huella_bytes": self.huella_bytes,
            "contexto": self.contexto,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }

    def limpiar(self):
        self.instancia = None
        self.huella_bytes = None
        self.contexto = ""
        self.timestamp = None

    def procesar_contexto(self, contexto: str, controlador_hardware: Any, id_alumno: Optional[int] = None) -> dict:
        match contexto:
            case "ticket":
                # AQUÍ NO HAY CAMBIOS: Solo leemos, no modificamos la DB
                user_id, score = controlador_hardware.identificar_usuario()
                if user_id > 0:
                    self.guardar_captura(
                        instancia={"user_id": user_id, "score": score},
                        huella_bytes=None,
                        contexto="ticket"
                    )
                    return {"estado": True, "mensaje": "Alumno identificado para ticket"}
                
                # Guardar error para que el frontend sepa que terminó
                self.guardar_captura(
                    instancia={"error": True, "mensaje": "No se pudo identificar al alumno"},
                    huella_bytes=None,
                    contexto="ticket_error"
                )
                return {"estado": False, "mensaje": "No se pudo identificar al alumno"}

            case "enrolar":
                exito, huella_bytes = controlador_hardware.capturar_plantilla()
                if not exito or huella_bytes is None:
                    return {"estado": False, "mensaje": "Fallo al capturar la huella"}

                if id_alumno is None:
                    return {"estado": False, "mensaje": "Falta el ID del alumno para enrolar"}

                # 1. Guardar en el Hardware (ZKTeco)
                guardado_hw = controlador_hardware.guardar_en_bd(id_alumno, huella_bytes)
                if not guardado_hw:
                    return {"estado": False, "mensaje": "Error al guardar huella en hardware"}
                
                #guardar en base de datos
                huella_hex = huella_bytes.hex()
                #Buscamos si el alumno tiene la huella registrada
                huella_db = self.db.query(Huella).filter(Huella.usuario_id == id_alumno).first()

                if huella_db:
                    #si existe la huella lo actualizamos
                    huella_db.huella_blob = huella_hex
                else: #si no existe la huella creamos un registro nuevo
                    nueva_huella = Huella(huella_blob=huella_hex, usuario_id=id_alumno)
                    self.db.add(nueva_huella)

                #confirmamos los cambios
                try:
                    self.db.commit()
                except Exception as e:
                    self.db.rollback()
                    return {"estado": False, "mensaje": f"Error al guardar huella en SQLite: {str(e)}"}

                self.guardar_captura(
                    instancia=None,
                    huella_bytes=huella_bytes,
                    contexto="enrolar"
                )
                return {"estado": True, "mensaje": "Huella enrolada y respaldada exitosamente"}

            case "editar":
                exito, huella_bytes = controlador_hardware.capturar_plantilla()
                if not exito or huella_bytes is None:
                    return {"estado": False, "mensaje": "Fallo al capturar la nueva huella"}

                if id_alumno is None:
                    return {"estado": False, "mensaje": "Falta el ID del alumno para editar"}

                # 1. Actualizar SQLite (upsert)
                # No usamos guardar_en_bd directo porque db_add falla si el userId
                # ya tiene un template cargado en la RAM del sensor desde el arranque.
                huella_hex = huella_bytes.hex()
                huella_db = self.db.query(Huella).filter(Huella.usuario_id == id_alumno).first()

                if huella_db:
                    huella_db.huella_blob = huella_hex
                else:
                    nueva_huella = Huella(huella_blob=huella_hex, usuario_id=id_alumno)
                    self.db.add(nueva_huella)

                try:
                    self.db.commit()
                except Exception as e:
                    self.db.rollback()
                    return {"estado": False, "mensaje": f"Error al guardar huella en SQLite: {str(e)}"}

                # 2. Refrescar la RAM del sensor: reiniciar + recargar todas las huellas desde SQLite.
                # Esto garantiza que la nueva huella quede activa sin necesidad de reiniciar el servidor.
                controlador_hardware.refrescar_bd_hardware()

                self.guardar_captura(
                    instancia=None,
                    huella_bytes=huella_bytes,
                    contexto="editar"
                )
                return {"estado": True, "mensaje": "Huella actualizada exitosamente"}

            case _:
                return {"estado": False, "mensaje": f"Contexto '{contexto}' no reconocido"}