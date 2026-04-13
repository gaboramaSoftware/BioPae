import time
from core.Services.userServces.Atributos.HuellaService import HuellaService
from core.Domain.Repository.UserRepository import registrarHuella


class EnrolarController:
    def __init__(self):
        self.huella_service = HuellaService()
        exito_init, mensaje_init = self.huella_service.inicializar()
        if not exito_init:
            print(f"[AVISO] Sensor no disponible al iniciar: {mensaje_init}")

    def enrolarHuella(self, id_usuario: int) -> dict:
        try:
            exito_cap = False
            huella_bytes = None
            intentos = 0
            max_intentos = 60

            print(f"Coloque el dedo en el sensor para el usuario {id_usuario}...")

            while not exito_cap:
                exito_cap, huella_bytes = self.huella_service.capturar_plantilla()

                if exito_cap and huella_bytes is not None:
                    print("¡Huella capturada con éxito!")
                    break

                intentos += 1
                if intentos >= max_intentos:
                    return {"estado": False, "mensaje": "Tiempo de espera agotado al capturar la huella"}

                print(f"Intento {intentos}/{max_intentos}. Esperando huella...")
                time.sleep(1)

            # Guardar en memoria interna del lector (hardware)
            exito_hardware = self.huella_service.guardar_en_bd(id_usuario, huella_bytes)
            if not exito_hardware:
                return {"estado": False, "mensaje": "Error al guardar la huella en el hardware"}

            # Guardar en la base de datos SQLite
            exito_sqlite = registrarHuella(id_usuario, huella_bytes)
            if not exito_sqlite:
                return {"estado": False, "mensaje": "Huella guardada en sensor, pero falló el registro en la base de datos"}

            return {
                "estado": True,
                "mensaje": "Enrolamiento completado con éxito",
                "id_usuario": id_usuario,
                "data_size": len(huella_bytes)
            }

        except Exception as e:
            return {"estado": False, "mensaje": f"Error inesperado: {str(e)}"}

        finally:
            self.huella_service.cerrar()
