import sys, os, threading, time, logging

logger = logging.getLogger(__name__)

# Ruta al hardware compilado
ruta_hardware = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../infra/Hardware"))

if os.name == 'nt':
    try:
        os.add_dll_directory(ruta_hardware)
        for subfolder in ['bin', 'x64lib']:
            dll_path = os.path.join(ruta_hardware, subfolder)
            if os.path.exists(dll_path):
                os.add_dll_directory(dll_path)
    except Exception as e:
        print(f"[ERROR] No se pudo registrar el directorio de DLLs: {e}")

if ruta_hardware not in sys.path:
    sys.path.append(ruta_hardware)

try:
    import sensorWrapper
except ImportError as e:
    print(f"[PRECAUCIÓN] No se pudo cargar el sensorWrapper de C++. Error: {e}")
    sensorWrapper = None

class HuellaService:
    _instancia = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instancia is None:
                cls._instancia = super(HuellaService, cls).__new__(cls)
                cls._instancia._inicializado = False
            return cls._instancia

    def __init__(self):
        if self._inicializado:
            return

        self.sensor = None
        self.init_lock = threading.Lock()       # Solo para init/close
        self.capture_lock = threading.Lock()    # Solo para captura/identificación

        if sensorWrapper:
            self.sensor = sensorWrapper.Sensor()

        self._inicializado = True

    def __del__(self):
        self.cerrar()

    @property
    def esta_listo(self) -> bool:
        """Verifica si el sensor está inicializado sin tomar ningún lock."""
        return self.sensor is not None

    def inicializar(self) -> tuple[bool, str]:
        with self.init_lock:
            if not self.sensor:
                return False, "La librería C++ del lector no cargó correctamente."
            exito = self.sensor.init_sensor()
            if exito:
                return True, "Lector inicializado correctamente."
            return False, "Error al inicializar el hardware del lector."

    def cerrar(self):
        with self.init_lock:
            if hasattr(self, 'sensor') and self.sensor:
                try:
                    self.sensor.close_sensor()
                except Exception:
                    pass

    def capturar_plantilla(self) -> tuple[bool, bytes | None]:
        """Usa el modo bloqueante del SDK: espera hasta tener una captura de calidad."""
        with self.capture_lock:
            if not self.sensor:
                return False, None
            exito, data_lista = self.sensor.capture_template()
            if exito and data_lista:
                return True, bytes(data_lista)
            return False, None

    def identificar_usuario(self) -> tuple[int, float]:
        """Captura bloqueante + identificación en un solo intento. El frontend maneja reintentos."""
        with self.capture_lock:
            if not self.sensor:
                return -1, 0.0
            exito, data_lista = self.sensor.capture_template()
            if not exito or not data_lista:
                logger.warning("[IDENT] No se pudo capturar huella")
                return -1, 0.0
            encontrado, user_id, score = self.sensor.db_identify(data_lista)
            if encontrado:
                logger.info(f"[IDENT] Usuario {user_id} identificado (score={score})")
                return user_id, float(score)
            logger.warning("[IDENT] Huella capturada pero no reconocida")
            return -1, 0.0

    def capturar_y_identificar(self) -> tuple[int, float, bytes | None]:
        """Captura bloqueante + intento de identificación. Retorna bytes aunque no identifique."""
        with self.capture_lock:
            if not self.sensor:
                return -1, 0.0, None
            exito, data_lista = self.sensor.capture_template()
            if not exito or not data_lista:
                return -1, 0.0, None
            huella_bytes = bytes(data_lista)
            encontrado, user_id, score = self.sensor.db_identify(data_lista)
            if encontrado:
                return user_id, float(score), huella_bytes
            return -1, 0.0, huella_bytes

    def guardar_en_bd(self, id_usuario: int, huella_bytes: bytes) -> bool:
        with self.capture_lock:
            if not self.sensor:
                return False
            huella_lista = list(huella_bytes)
            if not huella_lista:
                return False
            return self.sensor.db_add(huella_lista, id_usuario)

    def refrescar_bd_hardware(self) -> bool:
        """Reinicia la BD en RAM del sensor y recarga todas las huellas desde SQLite.
        Necesario al editar una huella porque db_add no puede sobrescribir un userId ya cargado."""
        with self.init_lock:
            with self.capture_lock:
                if not self.sensor:
                    return False
                try:
                    self.sensor.close_sensor()
                    if not self.sensor.init_sensor():
                        logger.error("[REFRESH] No se pudo reiniciar el sensor.")
                        return False
                except Exception as e:
                    logger.error(f"[REFRESH] Error al reiniciar sensor: {e}")
                    return False

        resultado = self.cargar_huellas_iniciales()
        logger.info(f"[REFRESH] BD hardware refrescada: {resultado}")
        return True

    def cargar_huellas_iniciales(self) -> dict:
        """
        Lee todas las huellas persistidas en SQLite y las inyecta en la RAM del sensor.
        Debe llamarse una sola vez al arrancar el servidor, después de inicializar().
        Retorna un dict con las claves 'cargadas' y 'fallidas'.
        """
        # Importaciones locales para evitar dependencias circulares en el arranque
        from core.Domain.Repository.UserRepository import SessionLocal
        from infra.DB.modelos import Huella

        if not self.sensor:
            logger.warning("[STARTUP] Sensor no disponible. No se cargaron huellas en RAM.")
            return {"cargadas": 0, "fallidas": 0}

        cargadas = 0
        fallidas = 0
        db = SessionLocal()
        try:
            huellas = db.query(Huella).all()
            logger.info(f"[STARTUP] {len(huellas)} huellas encontradas en SQLite. Inyectando en RAM...")

            for huella in huellas:
                try:
                    if huella.usuario_id is None:
                        logger.warning(f"[STARTUP] Huella id={huella.id} sin usuario_id (huérfana). Saltando.")
                        fallidas += 1
                        continue
                    if not huella.huella_blob:
                        raise ValueError("huella_blob vacío")
                    huella_bytes = bytes.fromhex(huella.huella_blob)
                    huella_lista = list(huella_bytes)
                    exito = self.sensor.db_add(huella_lista, huella.usuario_id)
                    if exito:
                        cargadas += 1
                        logger.info(f"[STARTUP] Huella usuario_id={huella.usuario_id} cargada OK.")
                    else:
                        fallidas += 1
                        logger.error(
                            f"[STARTUP] db_add rechazó la huella de usuario_id={huella.usuario_id}."
                        )
                except Exception as e:
                    fallidas += 1
                    logger.error(
                        f"[STARTUP] Error al cargar huella usuario_id={huella.usuario_id}: {e}"
                    )

            logger.info(f"[STARTUP] Carga completa: {cargadas} OK, {fallidas} fallidas.")
            return {"cargadas": cargadas, "fallidas": fallidas}
        finally:
            db.close()