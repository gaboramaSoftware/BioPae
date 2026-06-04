"""
Script temporal: inserta 50 registros de prueba entre el 2026-04-06 y 2026-04-09
usando los alumnos que ya existen en la base de datos.
"""
import random
import sqlite3
from datetime import date, time, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "infra" / "DB" / "biopae.db"

FECHAS = [date(2026, 4, 6), date(2026, 4, 7), date(2026, 4, 8), date(2026, 4, 9)]
TIPOS  = ["desayuno", "almuerzo"]
ESTADO = "Aprobado"

def hora_aleatoria(tipo: str) -> time:
    if tipo == "desayuno":
        h = random.randint(7, 9)
    else:
        h = random.randint(12, 14)
    m = random.randint(0, 59)
    s = random.randint(0, 59)
    return time(h, m, s)

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Obtener IDs de alumnos existentes
cur.execute("SELECT id FROM usuarios")
ids_alumnos = [row[0] for row in cur.fetchall()]

if not ids_alumnos:
    print("No hay alumnos en el sistema. Agrega alumnos primero.")
    con.close()
    exit(1)

# Obtener el primer totem disponible
cur.execute("SELECT id FROM totems LIMIT 1")
row = cur.fetchone()
totem_id = row[0] if row else None

insertados = 0
intentos   = 0

while insertados < 50 and intentos < 500:
    intentos += 1
    usuario_id = random.choice(ids_alumnos)
    fecha      = random.choice(FECHAS)
    tipo       = random.choice(TIPOS)
    hora       = hora_aleatoria(tipo)

    # Evitar duplicados (mismo alumno, fecha y tipo)
    cur.execute(
        "SELECT id FROM registros WHERE usuario_id=? AND fecha=? AND tipo_solicitud=?",
        (usuario_id, fecha.isoformat(), tipo)
    )
    if cur.fetchone():
        continue

    cur.execute(
        """INSERT INTO registros (usuario_id, totem_id, fecha, hora, estado_registro, tipo_solicitud)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (usuario_id, totem_id, fecha.isoformat(), hora.strftime("%H:%M:%S"), ESTADO, tipo)
    )
    insertados += 1

con.commit()
con.close()
print(f"Insertados {insertados} registros de prueba en biopae.db")
