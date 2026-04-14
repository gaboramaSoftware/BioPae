import sqlite3

conn = sqlite3.connect('infra/DB/biopae.db')
cursor = conn.cursor()

print("--- ALUMNOS REGISTRADOS (CON HUELLA) ---")

cursor.execute('''
    SELECT u.id, u.nombre, u.rut, c.nivel, c.numero, c.letra
    FROM usuarios u
    JOIN huellas h ON u.id = h.usuario_id
    LEFT JOIN cursos c ON u.curso_id = c.id
    ORDER BY u.id ASC
''')

registrados = cursor.fetchall()

print(f"\nTotal alumnos con huella: {len(registrados)}")
print("-" * 85)
print(f"{'ID':<4} | {'Nombre':<35} | {'RUT':<12} | {'Curso':<20}")
print("-" * 85)

for r in registrados:
    # Use parts if available, else a placeholder
    try:
        curso = f"{r[4] if r[4] else ''} {r[3] if r[3] else 'S/C'} {r[5] if r[5] else ''}".strip()
    except:
        curso = "Error en curso"
    
    nombre = r[1][:33] + ".." if len(r[1]) > 35 else r[1]
    print(f"{r[0]:<4} | {nombre:<35} | {r[2] if r[2] else 'N/A':<12} | {curso:<20}")

conn.close()
