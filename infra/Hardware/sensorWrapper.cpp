#include "Sensor.h"
#include <pybind11/pybind11.h>
#include <pybind11/stl.h> // Para que convierta std::vector a list de Python automáticamente
#include <tuple>
namespace py = pybind11;

PYBIND11_MODULE(sensorWrapper, m) {
  py::class_<Sensor>(m, "Sensor")
      .def(py::init<>())
      .def("init_sensor", &Sensor::initSensor)
      .def("close_sensor", &Sensor::closeSensor)
      .def("db_add", &Sensor::DBAdd)
      .def("capture_template_immediate", [](Sensor &s){
        std::vector<unsigned char> data;
        bool ok;
        {
          py::gil_scoped_release release;
          ok = s.captureTemplateImmediate(data);
        }
        return std::make_pair(ok, data);
      })
      .def("db_identify", [](Sensor &s, const std::vector<unsigned char> &templateData) {
        int userId = 0;
        int score = 0;
        bool ok;
        {
          py::gil_scoped_release release;
          ok = s.DBIdentify(templateData, userId, score);
        }
        return std::make_tuple(ok, userId, score);
      })
      .def("capture_template", [](Sensor &s) {
        std::vector<unsigned char> data;
        bool ok;
        {
          py::gil_scoped_release release;
          ok = s.captureCreateTemplate(data);
        }
        return std::make_pair(ok, data);
      });      
}