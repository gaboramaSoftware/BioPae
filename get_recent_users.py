import sqlite3

conn = sqlite3.connect('infra/DB/biopae.db')
cursor = conn.cursor()

cursor.execute('SELECT count(*) FROM usuarios')
count = cursor.fetchone()[0]
print(f"Total usuarios: {count}")

cursor.execute('SELECT count(*) FROM huellas')
huellas = cursor.fetchone()[0]
print(f"Total huellas: {huellas}")

print("\n--- ULTIMOS 10 REGISTRADOS ---")
cursor.execute('''
    SELECT u.id, u.nombre, u.rut, c.nivel, c.numero, c.letra, h.id as tiene_huella
    FROM usuarios u
    LEFT JOIN cursos c ON u.curso_id = c.id
    LEFT JOIN huellas h ON u.id = h.usuario_id
    ORDER BY u.id DESC
    LIMIT 10
''')

for r in cursor.fetchall():
    curso = f"{r[4] if r[4] else ''} {r[3]} {r[5] if r[5] else ''}".strip()
    huella = "SI" if r[6] else "NO"
    print(f"ID: {r[0]} | Nombre: {r[1]} | RUT: {r[2]} | Curso: {curso} | Huella: {huella}")

conn.close()
