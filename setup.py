from setuptools import setup, Extension
import pybind11
import os

hw = os.path.join("infra", "Hardware")

ext = Extension(
    name="sensorWrapper",
    sources=[
        os.path.join(hw, "sensorWrapper.cpp"),
        os.path.join(hw, "Sensor.cpp"),
    ],
    include_dirs=[
        pybind11.get_include(),
        os.path.join(hw, "include"),
    ],
    library_dirs=[os.path.join(hw, "x64lib")],
    libraries=["libzkfp"],
    language="c++",
    extra_compile_args=["/std:c++17"],
)

setup(name="sensorWrapper", ext_modules=[ext])
