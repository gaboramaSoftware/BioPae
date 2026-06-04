import sqlite3

conn = sqlite3.connect('infra/DB/biopae.db')
cursor = conn.cursor()

print("--- Comparación de Usuarios Nuevos (ID >= 160) con Usuarios Previos (ID < 160) ---")

# Get new users
cursor.execute('SELECT id, nombre, rut, curso_id FROM usuarios WHERE id >= 160')
new_users = cursor.fetchall()

found_matches = []

for n_id, n_nombre, n_rut, n_curso_id in new_users:
    # Search for similar names in old users (ignoring case and partial match)
    # We search in ID < 160
    cursor.execute('''
        SELECT id, nombre, rut, curso_id 
        FROM usuarios 
        WHERE id < 160 AND (nombre LIKE ? OR rut = ?)
    ''', (f"%{n_nombre}%", n_rut))
    
    matches = cursor.fetchall()
    if matches:
        found_matches.append((n_id, n_nombre, matches))

if found_matches:
    print(f"\nSe encontraron {len(found_matches)} posibles coincidencias de alumnos pre-cargados que se re-enrolaron como 'nuevos':")
    for n_id, n_nombre, matches in found_matches:
        print(f"\nNuevo: ID {n_id} - {n_nombre}")
        for m_id, m_nombre, m_rut, m_curso_id in matches:
            print(f"  Coincide con Pre-cargado: ID {m_id} - {m_nombre} (RUT: {m_rut})")
else:
    print("\nNo se encontraron coincidencias exactas o parciales por nombre/RUT.")
    print("Parece que los 21 alumnos registrados hoy son efectivamente nuevos en la base de datos.")

conn.close()
