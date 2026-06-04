"""
Migración: normaliza la tabla 'cursos' al nuevo esquema.

Antes: nivel="1° Básico", letra="A"
Después: numero=1, nivel="Basico", letra="A"
"""
import re
import shutil
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "infra" / "DB" / "biopae.db"
BACKUP_PATH = DB_PATH.with_suffix(".db.bak")

# ── Patrones de detección ─────────────────────────────────────────────────────

NIVEL_MAP = {
    "basico": "Basico",
    "básico": "Basico",
    "medio":  "Medio",
}

def parsear_nivel(nivel_raw: str, letra_raw: str):
    """
    Devuelve (numero, nivel_normalizado, letra_normalizada).

    Casos que maneja:
      "1° Básico"                          → (1, "Basico", letra_raw)
      "2° Medio"                           → (2, "Medio",  letra_raw)
      "Kinder"                             → (None, "Kinder",    letra_raw)
      "Pre-Kinder"                         → (None, "Pre-Kinder", letra_raw)
      "2° nivel de Transición (Kinder) B"  → (None, "Kinder",    "B")
      "1er nivel de Transición (Pre-kinder) A" → (None, "Pre-Kinder", "A")
    """
    texto = nivel_raw.strip()
    letra = (letra_raw or "").strip()

    # ── Pre-Kinder (antes que Kinder para que no haga match parcial) ──────────
    if re.search(r"pre.?kinder", texto, re.IGNORECASE):
        # La letra puede estar embebida al final del string
        letra_emb = re.search(r'\b([A-J])\s*$', texto)
        if letra_emb and not letra:
            letra = letra_emb.group(1).upper()
        return None, "Pre-Kinder", letra

    # ── Kinder ────────────────────────────────────────────────────────────────
    if re.search(r'\bkinder\b', texto, re.IGNORECASE):
        letra_emb = re.search(r'\b([A-J])\s*$', texto)
        if letra_emb and not letra:
            letra = letra_emb.group(1).upper()
        return None, "Kinder", letra

    # ── N° Básico / N° Medio ─────────────────────────────────────────────────
    m = re.match(r'^(\d+)[°º\.]?\s*(.+)', texto)
    if m:
        numero = int(m.group(1))
        resto  = m.group(2).strip()

        # Extraer letra embebida al final (ej: "básico A")
        letra_emb = re.search(r'\b([A-J])\s*$', resto)
        if letra_emb:
            if not letra:
                letra = letra_emb.group(1).upper()
            resto = resto[:letra_emb.start()].strip()

        for clave, valor in NIVEL_MAP.items():
            if clave in resto.lower():
                return numero, valor, letra

        # Fallback: capitalizar lo que quede
        return numero, resto.capitalize(), letra

    # ── Sin número (Kinder/Pre-Kinder ya atrapados; esto es fallback) ─────────
    return None, texto, letra


# ── Migración ────────────────────────────────────────────────────────────────

def main():
    if not DB_PATH.exists():
        print(f"No se encontró la base de datos en {DB_PATH}")
        return

    # Backup antes de tocar nada
    shutil.copy2(DB_PATH, BACKUP_PATH)
    print(f"Backup guardado en {BACKUP_PATH}")

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # ── PASO 1: Borrar cursos con letra embebida en nivel (ej: "1° básico A") ──
    # Son cursos importados de JUNAEB donde la letra quedó pegada al nivel.
    # El patrón: nivel termina en " + una sola letra mayúscula" y letra está vacía.
    cur.execute("PRAGMA foreign_keys = OFF")

    cursos_basura = cur.execute(
        "SELECT id FROM cursos WHERE nivel GLOB '* [A-Z]'"
    ).fetchall()
    ids_basura = [row[0] for row in cursos_basura]

    if ids_basura:
        placeholders = ",".join("?" * len(ids_basura))

        # Obtener usuarios afectados
        usuarios_afectados = cur.execute(
            f"SELECT id FROM usuarios WHERE curso_id IN ({placeholders})", ids_basura
        ).fetchall()
        ids_usuarios = [row[0] for row in usuarios_afectados]

        if ids_usuarios:
            u_ph = ",".join("?" * len(ids_usuarios))
            # Borrar tickets de registros de esos usuarios
            reg_ids = cur.execute(
                f"SELECT id FROM registros WHERE usuario_id IN ({u_ph})", ids_usuarios
            ).fetchall()
            reg_ids = [r[0] for r in reg_ids]
            if reg_ids:
                r_ph = ",".join("?" * len(reg_ids))
                cur.execute(f"DELETE FROM tickets WHERE registro_id IN ({r_ph})", reg_ids)
            # Borrar tickets directos
            cur.execute(f"DELETE FROM tickets WHERE usuario_id IN ({u_ph})", ids_usuarios)
            # Borrar registros
            cur.execute(f"DELETE FROM registros WHERE usuario_id IN ({u_ph})", ids_usuarios)
            # Borrar huellas
            cur.execute(f"DELETE FROM huellas WHERE usuario_id IN ({u_ph})", ids_usuarios)
            # Borrar usuarios
            cur.execute(f"DELETE FROM usuarios WHERE id IN ({u_ph})", ids_usuarios)

        # Borrar cursos basura
        cur.execute(f"DELETE FROM cursos WHERE id IN ({placeholders})", ids_basura)
        print(f"Eliminados: {len(ids_basura)} cursos con letra embebida y {len(ids_usuarios)} alumnos vinculados.")

    # ── PASO 2: Agregar columna numero si no existe ───────────────────────────
    cols = [row[1] for row in cur.execute("PRAGMA table_info(cursos)")]
    if "numero" not in cols:
        cur.execute("ALTER TABLE cursos ADD COLUMN numero INTEGER")
        print("Columna 'numero' agregada.")
    else:
        print("Columna 'numero' ya existe, actualizando valores.")

    # ── PASO 3: Normalizar los cursos restantes ───────────────────────────────
    cursos = cur.execute("SELECT id, nivel, letra FROM cursos").fetchall()

    sin_match = []
    for cid, nivel_raw, letra_raw in cursos:
        numero, nivel_norm, letra_norm = parsear_nivel(nivel_raw, letra_raw)
        cur.execute(
            "UPDATE cursos SET numero = ?, nivel = ?, letra = ? WHERE id = ?",
            (numero, nivel_norm, letra_norm, cid)
        )
        if nivel_norm not in ("Basico", "Medio", "Kinder", "Pre-Kinder"):
            sin_match.append((cid, nivel_raw, "→", numero, nivel_norm, letra_norm))

    con.commit()
    cur.execute("PRAGMA foreign_keys = ON")
    con.close()

    print(f"Migración completada. {len(cursos)} cursos normalizados.")
    if sin_match:
        print(f"\nATENCION: {len(sin_match)} cursos con nivel no reconocido (revisar manualmente):")
        for row in sin_match:
            print(" ", row)
    else:
        print("Todos los cursos normalizados correctamente.")


if __name__ == "__main__":
    main()
