import json
import itertools
import os

class GestorCursos:
    def __init__(self, letras_activas=None):
        self.grados = {'basico': 'Basico', 'medio': 'Medio', 'kinder': 'Kinder', 'pre-kinder': 'Pre-Kinder'}
        # Por defecto A-F (tamaño real de un colegio típico)
        self.letras = letras_activas if letras_activas else ['a', 'b', 'c', 'd', 'e', 'f']
        self.niveles = ['1', '2', '3', '4', '5', '6', '7', '8']
        self.diccionario_cursos = {}

    def generar_combinaciones(self):
        """Genera el diccionario con todas las combinaciones válidas del sistema educativo chileno."""
        self.diccionario_cursos = {}

        for nivel, (llave_grado, valor_grado), letra in itertools.product(self.niveles, self.grados.items(), self.letras):

            # Media solo existe del 1° al 4°
            if llave_grado == 'medio' and int(nivel) > 4:
                continue

            # Kinder y Pre-Kinder no tienen nivel numérico
            if llave_grado in ['kinder', 'pre-kinder']:
                if nivel != '1':
                    continue
                key = f"{llave_grado}_{letra}"
                value = f"{valor_grado} {letra.upper()}"
            else:
                key = f"{nivel}_{llave_grado}_{letra}"
                value = f"{nivel} {valor_grado} {letra.upper()}"

            self.diccionario_cursos[key] = value

        return self.diccionario_cursos

    def exportar_a_js(self, ruta_salida: str, usar_export: bool = False):
        """Exporta el diccionario generado a un archivo .js.

        Args:
            ruta_salida: Ruta del archivo de salida (.js)
            usar_export: Si True, usa 'export const cursos' (módulos ES6).
                         Si False, usa 'const CURSOS' (script normal).
        """
        if not self.diccionario_cursos:
            self.generar_combinaciones()

        os.makedirs(os.path.dirname(ruta_salida), exist_ok=True)

        datos_json = json.dumps(self.diccionario_cursos, indent=4, ensure_ascii=False)
        prefijo = "export const cursos" if usar_export else "const CURSOS"

        with open(ruta_salida, "w", encoding="utf-8") as f:
            f.write(f"{prefijo} = {datos_json};\n")

        print(f"✓ {len(self.diccionario_cursos)} cursos exportados a: {ruta_salida}")

    def obtener_curso(self, curso_input: str) -> str:
        """Limpia un texto sucio y devuelve el nombre formateado del curso"""
        # Limpiamos el texto para que no importen mayúsculas ni espacios extra
        curso_texto = str(curso_input).lower().strip()
        
        grado_encontrado = ""
        letra_encontrada = ""
        nivel_encontrado = ""

        # BUSQUEDA DE PALABRAS CLAVE
        for clave, valor in self.grados.items():
            if clave in curso_texto:
                grado_encontrado = valor
                break

        for l in self.letras:
            if f" {l}" in f" {curso_texto}" or f"-{l}" in curso_texto:
                letra_encontrada = l.upper()
                break

        for n in self.niveles:
            if n in curso_texto: 
                nivel_encontrado = n
                break

        # Construimos el resultado final limpio
        if grado_encontrado and letra_encontrada:
            return f"{nivel_encontrado}° {grado_encontrado} {letra_encontrada}".strip()
        
        raise ValueError(f"No pude entender el curso: {curso_input}")


# --- EJECUCIÓN ---
if __name__ == "__main__":
    import os

    gestor = GestorCursos(letras_activas=['a', 'b', 'c', 'd', 'e', 'f'])
    gestor.generar_combinaciones()

    # Para app.js del panel admin (módulo ES6)
    ruta_admin = os.path.join(os.path.dirname(__file__), "../../../../Frontend/src/index/app.js.cursos.js")
    gestor.exportar_a_js(ruta_admin, usar_export=True)

    # Para renderer.js del tótem (script normal, sin módulos)
    ruta_totem = os.path.join(os.path.dirname(__file__), "../../../../Frontend/src/js/cursos_data.js")
    gestor.exportar_a_js(ruta_totem, usar_export=False)

    print(f"\nEjemplos:")
    for k, v in list(gestor.diccionario_cursos.items())[:5]:
        print(f"  '{k}': '{v}'")