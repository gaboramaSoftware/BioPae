# core/Services/userServces/Usuario/nombreService.py
from core.Services.userServces.Usuario.alumnoService import AlumnoService

class NombreService:
    def __init__(self):
        self.alumno_service = AlumnoService()
        # Diccionario de caracteres permitidos (esto sí es válido mantenerlo aquí)
        self.char_dictionary = {char: True for char in "áéíóúÁÉÍÓÚüÜñÑ -'"}

    def separar_nombres_manual(self, nombres: str) -> list:
        palabras = []
        palabra_actual = ""

        for char in nombres:
            if char.isspace():
                if palabra_actual: 
                    palabras.append(palabra_actual)
                    palabra_actual = "" 
            else:
                palabra_actual += char
        
        if palabra_actual:
            palabras.append(palabra_actual)

        if len(palabras) == 0:
            return [""]
        elif len(palabras) == 1:
            primer_nombre = palabras[0]
            otros_nombres = ""
        else:
            primer_nombre = palabras[0]
            otros_nombres = " ".join(palabras[1:])
        
        return [primer_nombre + " " + otros_nombres]
    
    def validar_nombre(self, texto: str) -> bool:
        return all(char.isalpha() or char.isspace() or char in self.char_dictionary for char in texto)

    def limpiar_nombres(self, todos_los_nombres: str, apellido_paterno: str, apellido_materno: str) -> dict:
        campos = [todos_los_nombres, apellido_paterno, apellido_materno]
        
        for campo in campos:
            if not self.validar_nombre(campo):
                return {
                    "estado": False, 
                    "mensaje": f"El campo '{campo}' contiene caracteres no permitidos."
                }
        
        # Devolvemos los datos limpios en lugar de guardarlos en "self"
        return {
            "estado": True, 
            "mensaje": "Nombre y Apellidos válidos.",
            "datos_limpios": {
                "nombres": todos_los_nombres.strip(),
                "apellido_paterno": apellido_paterno.strip(),
                "apellido_materno": apellido_materno.strip()
            }
        }
    
    # Hemos unificado las 3 llamadas a la BD en una sola para ser más eficientes
    def obtener_perfil_nombres(self, id_usuario: int) -> dict:
        alumno = self.alumno_service.obtener_alumno(id_usuario)
        if alumno:
            return {
                "nombre": alumno.nombre,
                "apellido_paterno": alumno.apellido_paterno,
                "apellido_materno": alumno.apellido_materno
            }
        return None
    
    #pasarle los datos limpios al objeto usuario para que los guarde en la BD del sistema
    def guardar_nombres(self, id_usuario: int, nombres: str, apellido_paterno: str, apellido_materno: str) -> bool:
        nombre_final = nombres.strip()
        apellido_paterno_final = apellido_paterno.strip()
        apellido_materno_final = apellido_materno.strip()
        return self.alumno_service.guardar_nombres(id_usuario, nombre_final, apellido_materno_final, apellido_materno_final)