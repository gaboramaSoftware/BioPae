import openpyxl
import os

# Nombres registrados hoy segun los logs
nombres_hoy = [
    "Sofia Moraga", "Jessica Diaz", "Mariuxi Mercado", "Sofia Labbe", "Matias Infante",
    "Geremyas Arratia", "Mateo Cabello", "Nayareth Carmona", "Martin Almendras", 
    "Emili Arce", "Dylan Ibarra", "Stiven Videla", "Dominic Guajardo", "Fabrian Fernandez",
    "Jeslye Mendoza", "Colomba Caceres", "Ezequiel Zuleta", "Agustin Sepulveda", 
    "Joaquin Castro", "Maximiliano Sandoval", "diego sayago"
]

files = ["alumnosTotales.xlsx", "alumnos junaeb final.xlsx"]

print("--- Buscando coincidencias en Archivos Excel ---")

for file_name in files:
    if not os.path.exists(file_name):
        print(f"Archivo no encontrado: {file_name}")
        continue
    
    print(f"\nRevisando {file_name}...")
    try:
        wb = openpyxl.load_workbook(file_name, data_only=True)
        ws = wb.active
        
        matches_found = 0
        for row in ws.iter_rows(values_only=True):
            row_str = " ".join([str(cell).lower() for cell in row if cell is not None])
            for nombre in nombres_hoy:
                if nombre.lower() in row_str:
                    print(f"  [COINCIDENCIA] '{nombre}' encontrado en fila: {row}")
                    matches_found += 1
        
        if matches_found == 0:
            print("  No se encontraron coincidencias en este archivo.")
        else:
            print(f"  Total coincidencias en {file_name}: {matches_found}")
            
    except Exception as e:
        print(f"Error procesando {file_name}: {e}")

