import re
import itertools

class RunService:
    def obtenerRun(self, run: str) -> str:
        # Limpiamos el run de puntos, guiones y espacios
        run = str(run).strip().upper()
        run = re.sub(r'[^0-9Kk]', '', run)
        return run

    def separadorRun(self, run: str):
        run = self.obtenerRun(run)
        if len(run) <= 1:
            raise ValueError("Run inválido")
        
        # Separar el cuerpo y el DV
        cuerpo_run = run[:-1]
        dv_run = run[-1]
        return cuerpo_run, dv_run

    @staticmethod
    def algoritmoM11(cuerpo: str) -> str:
        # IMPORTANTE: Aquí usamos "cuerpo", que es el nombre del parámetro
        reverso = map(int, reversed(cuerpo))
        multiplicador = itertools.cycle([2, 3, 4, 5, 6, 7])
        suma = sum(a * b for a, b in zip(reverso, multiplicador))
        
        resto = suma % 11
        dv = 11 - resto
        
        if dv == 11:
            return "0"
        elif dv == 10:
            return "K"
        else:
            return str(dv)
    
    def validarRun(self, run_completo: str) -> bool:
        try:
            # 1. Separamos
            cuerpo, dv_entregado = self.separadorRun(run_completo)
            # 2. Calculamos el DV que DEBERÍA tener ese cuerpo
            dv_calculado = self.algoritmoM11(cuerpo)
            # 3. Comparamos (el entregado puede ser 'k' minúscula, por eso upper)
            return dv_calculado == dv_entregado.upper()
        except (ValueError, StopIteration):
            return False
        
    def obtenerRunCompleto(self, run: str) -> str:
        # Si te pasan un RUN con o sin DV, primero extraemos solo el cuerpo
        try:
            cuerpo, _ = self.separadorRun(run)
        except ValueError:
            cuerpo = self.obtenerRun(run)
            
        dv_calculado = self.algoritmoM11(cuerpo)
        run_validado = f"{cuerpo}-{dv_calculado}" 
        return run_validado
    
    def run_en_blanco(self, run: str) -> str:
        pass