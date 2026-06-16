import os
import shutil
import sqlite3
from fastapi import HTTPException, status

# === RUTA DINÁMICA PARA %APPDATA% ===
DATA_DIR = os.environ.get("BIOPAE_DATA_DIR", "DB")
DB_PATH = os.path.join(DATA_DIR, "biopae.db") 

def generate_sql_dump_stream():
    """
    Genera un streaming del dump SQL línea por línea.
    Evita picos de memoria RAM en el hardware del Tótem.
    """
    if not os.path.exists(DB_PATH):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="La base de datos del sistema no fue encontrada en la ruta de AppData."
        )
    try:
        conn = sqlite3.connect(DB_PATH)
        for line in conn.iterdump():
            yield f"{line}\n"
        conn.close()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error crítico al generar el volcado SQL: {str(e)}"
        )

def safe_import_sql(sql_content: str):
    """
    Importación con Snapshot de Recuperación Inmediata.
    Si el archivo SQL tiene errores, no rompe la base de datos actual.
    """
    backup_recovery_path = f"{DB_PATH}.bak"
    has_previous_db = os.path.exists(DB_PATH)
    
    # 1. Crear snapshot físico de seguridad en %APPDATA%
    if has_previous_db:
        shutil.copy2(DB_PATH, backup_recovery_path)
        
    conn = None  # Inicializamos en None para evitar el error de Pylance
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Ejecuta el script SQL completo
        cursor.executescript(sql_content)
        conn.commit()
        conn.close()
        conn = None # Conexión cerrada con éxito
        
        # 2. Si todo salió bien, borramos el snapshot temporal
        if os.path.exists(backup_recovery_path):
            os.remove(backup_recovery_path)
            
    except Exception as e:
        # Validamos con seguridad si la conexión alcanzó a existir antes de cerrarla
        if conn is not None:
            try: 
                conn.close() 
            except: 
                pass
        
        # 3. ROLLBACK: Si falló, restauramos la versión original inmediatamente
        if has_previous_db and os.path.exists(backup_recovery_path):
            shutil.copy2(backup_recovery_path, DB_PATH)
            os.remove(backup_recovery_path)
            
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estructura SQL inválida. Se restauró la base de datos automáticamente. Detalle: {str(e)}"
        )