import os
import sqlite3
from sqlalchemy import create_engine

#funcion para buscar la base de datos en el sistema
def buscarDB():
    nombreDB = 'biopae.db'
    # Subimos 3 niveles desde core/Domain/Repository hasta Pydigitador
    rutaRaiz = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    print(f"escaneando carpetas dentro de {rutaRaiz}")

    #buscamos por las subcarpetas del proyecto
    for raiz, directorios, archivos in os.walk(rutaRaiz):
        if nombreDB in archivos:
            rutaFinal = os.path.join(raiz, nombreDB)
            print(f"Base de datos encontrada en {rutaFinal}")
            return rutaFinal
        
    # Si no la encuentra, la creamos en la raiz por defecto para evitar que devuelva None
    rutaPorDefecto = os.path.join(rutaRaiz, nombreDB)
    print(f"No se encontró. Se creará una nueva en {rutaPorDefecto}")
    return rutaPorDefecto

def iniciarDB():
    rutaDB = buscarDB()
    if rutaDB:
        return create_engine(f"sqlite:///{rutaDB}", connect_args={"check_same_thread": False})
    return None

def destruirDB():
    rutaDB = buscarDB()
    if rutaDB:
        os.remove(rutaDB)
        print(f"Base de datos eliminada en {rutaDB}")
    return None