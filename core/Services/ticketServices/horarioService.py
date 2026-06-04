from datetime import datetime, time


def obtener_tipo_racion() -> str | None:
    """
    Determina el tipo de ración según la hora actual.
    08:00 - 11:59 → desayuno
    12:00 - 23:59 → almuerzo
    Fuera de esos rangos → None (fuera de horario)
    """
    ahora = datetime.now().time()

    if time(8, 0) <= ahora < time(12, 0):
        return "desayuno"
    if time(12, 0) <= ahora < time(20, 0):
        return "almuerzo"
    return None


def descripcion_horario() -> str:
    """Retorna un mensaje legible del horario vigente."""
    tipo = obtener_tipo_racion()
    if tipo == "desayuno":
        return "Horario de desayuno (08:00 - 12:00)"
    if tipo == "almuerzo":
        return "Horario de almuerzo (12:00 - 20:00)"
    return "Fuera de horario de atención (08:00 - 20:00)"
