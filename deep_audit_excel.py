import openpyxl
import os
import sqlite3

# Get the names and RUTs of today's registrations from the DB
conn = sqlite3.connect('infra/DB/biopae.db')
cursor = conn.cursor()
cursor.execute('SELECT id, nombre, rut FROM usuarios WHERE id >= 160')
today_users = cursor.fetchall()
conn.close()

files = ["alumnosTotales.xlsx", "alumnos junaeb final.xlsx"]

print(f"--- Buscando {len(today_users)} alumnos en los Excel originales ---")

results = []

for file_name in files:
    if not os.path.exists(file_name):
        continue
    
    print(f"\nProcesando {file_name}...")
    wb = openpyxl.load_workbook(file_name, data_only=True)
    ws = wb.active
    
    # Analyze all rows once
    excel_data = []
    for row in ws.iter_rows(values_only=True):
        excel_data.append([str(c).lower() if c is not None else "" for c in row])

    for u_id, u_nombre, u_rut in today_users:
        found = False
        # Search by RUT first
        if u_rut:
            u_rut_clean = u_rut.replace(".", "").replace("-", "").lower()
            for row in excel_data:
                row_str = " ".join(row).replace(".", "").replace("-", "")
                if u_rut_clean in row_str:
                    results.append(f"ID {u_id} ({u_nombre}): Encontrado por RUT '{u_rut}' en {file_name}")
                    found = True
                    break
        
        # Search by Name parts if not found by RUT
        if not found:
            parts = [p.lower() for p in u_nombre.split() if len(p) > 2]
            best_match = None
            max_parts = 0
            for row in excel_data:
                row_str = " ".join(row)
                matches_parts = sum(1 for p in parts if p in row_str)
                if matches_parts > max_parts:
                    max_parts = matches_parts
                    best_match = " ".join(row)
            
            if max_parts >= 2: # At least two name parts match
                results.append(f"ID {u_id} ({u_nombre}): Probable coincidencia en {file_name} (Matches {max_parts} partes: {best_match})")
                found = True

print("\n--- RESULTADOS DE LA AUDITORIA ---")
if not results:
    print("Ninguno de los alumnos registrados hoy parece estar en las listas de Excel originales.")
else:
    for res in results:
        print(res)

print(f"\nTotal alumnos encontrados de las listas originales: {len(set([r.split(':')[0] for r in results]))} de {len(today_users)}")
