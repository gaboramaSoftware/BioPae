from core.Services.userServces.Atributos.HuellaService import HuellaService
import time

def probrar_sensor():
    print("--- 🧪 Iniciando Test de Hardware ---")
    service = HuellaService()
    
    # 1. Intentar Inicializar
    exito, msg = service.inicializar()
    print(f"Estado Inicialización: {exito} - {msg}")
    
    if not exito:
        print("❌ El sensor no respondió. ¿Está conectado por USB?")
        return

    try:
        print("\n🟢 SENSOR LISTO. Pon tu dedo en el lector ahora...")
        print("(Tienes 10 segundos antes de que expire el tiempo)")
        
        # 2. Capturar Huella
        start_time = time.time()
        while time.time() - start_time < 10:
            ok, huella = service.capturar_plantilla()
            if ok:
                print(f"✅ ¡HUELLA CAPTURADA! Tamaño de data: {len(huella)} bytes")
                # Aquí podrías ver los primeros 10 bytes para estar seguro
                print(f"Muestra de la data: {huella[:10].hex()}...")
                break
            time.sleep(0.5)
        else:
            print("⏳ Tiempo agotado. No se detectó ninguna huella.")

    finally:
        # 3. Siempre cerrar el hardware para no bloquear el puerto USB
        service.cerrar()
        print("\n--- 🏁 Test Finalizado y Sensor Cerrado ---")

if __name__ == "__main__":
    probrar_sensor()
