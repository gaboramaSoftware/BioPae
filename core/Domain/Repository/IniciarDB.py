import os
import sqlite3
from sqlalchemy import create_engine

#funcion para buscar la base de datos en el sistema
def buscarDB():
    nombreDB = 'biopae.db'
    # Subimos 3 niveles desde core/Domain/Repository hasta Pydigitador
    rutaRaiz = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    print(f"escaneando carpetas dentro de {rutaRaiz}")

    #buscamos por las subcarpetas del proyecto (ignorando carpetas ocultas como .claude, .git)
    for raiz, directorios, archivos in os.walk(rutaRaiz):
        directorios[:] = [d for d in directorios if not d.startswith('.')]
        if nombreDB in archivos:
            rutaFinal = os.path.join(raiz, nombreDB)
            print(f"Base de datos encontrada en {rutaFinal}")
            return rutaFinal
        
    # Si no la encuentra, la creamos en la raiz por defecto para evitar que devuelva None
    rutaPorDefecto = os.path.join(rutaRaiz, nombreDB)
    print(f"No se encontró. Se creará una nueva en {rutaPorDefecto}")
    return rutaPorDefecto

def _migrarDB(rutaDB: str):
    """Aplica migraciones incrementales a la BD existente."""
    conn = sqlite3.connect(rutaDB)
    cursor = conn.cursor()

    # Columna observaciones en usuarios
    columnas = [row[1] for row in cursor.execute("PRAGMA table_info(usuarios)").fetchall()]
    if "observaciones" not in columnas:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN observaciones TEXT")
        print("Migración: columna 'observaciones' agregada a usuarios")

    # Tabla raciones_config
    tablas = [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    if "raciones_config" not in tablas:
        cursor.execute("""
            CREATE TABLE raciones_config (
                id    INTEGER PRIMARY KEY,
                tipo  TEXT UNIQUE NOT NULL,
                total INTEGER NOT NULL DEFAULT 0
            )
        """)
        cursor.execute("INSERT INTO raciones_config (tipo, total) VALUES ('desayuno', 0)")
        cursor.execute("INSERT INTO raciones_config (tipo, total) VALUES ('almuerzo', 0)")
        print("Migración: tabla 'raciones_config' creada con filas iniciales")

    conn.commit()
    conn.close()

def iniciarDB():
    rutaDB = buscarDB()
    if rutaDB:
        if os.path.exists(rutaDB):
            _migrarDB(rutaDB)
        return create_engine(f"sqlite:///{rutaDB}", connect_args={"check_same_thread": False})
    return None

def destruirDB():
    rutaDB = buscarDB()
    if rutaDB:
        os.remove(rutaDB)
        print(f"Base de datos eliminada en {rutaDB}")
    return None