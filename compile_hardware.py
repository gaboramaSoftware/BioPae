import sys
import os
import pybind11
from setuptools import setup, Extension

print("--- 🛠️  Iniciando compilación del ZKTeco Wrapper ---")

hardware_dir = os.path.abspath("infra/Hardware")

ext_modules = [
    Extension(
        "sensorWrapper",
        sources=[
            os.path.join(hardware_dir, "sensorWrapper.cpp"),
            os.path.join(hardware_dir, "Sensor.cpp") # AQUÍ ESTABA EL ERROR: Faltaba incluir tu código fuente real
        ],
        include_dirs=[
            pybind11.get_include(),
            hardware_dir,
            os.path.join(hardware_dir, "include") # Para encontrar libzkfp.h
        ],
        library_dirs=[os.path.join(hardware_dir, "x64lib")], # Para encontrar libzkfp.lib
        libraries=["libzkfp"],
        language="c++",
        extra_compile_args=['/std:c++14'] if sys.platform == 'win32' else ['-std=c++14']
    )
]

# Forzamos los parámetros del comando setuptools
sys.argv = [sys.argv[0], "build_ext", "--inplace"]

if __name__ == "__main__":
    try:
        setup(
            name="sensorWrapper",
            ext_modules=ext_modules,
        )
        print("\n✅ ¡Éxito! El código C++ se compiló usando ZKTeco SDK SDK.")
    except Exception as e:
        print(f"\n❌ Error en la compilación: {e}")
