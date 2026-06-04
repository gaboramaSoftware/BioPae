// sensor.h

// el service del sensor, que se comunica con el hardware y la base de datos
#pragma once // evita duplicados

#include <string>
#include <vector>
#include <windows.h>

// zkteco sdk
#include "include/libzkfp.h"
#include "include/libzkfperrdef.h"

class Sensor {
public:
#define DEFAULT_POLL_INTERVAL_MS 30  // 30 milisegundos
#define DEFAULT_TIMEOUT_MS 5000      // 5 segundos (reducido para evitar lock prolongado)
#define MAX_TEMPLATE_SIZE 2048

  // constructor / destructor
  Sensor();
  ~Sensor();

  // iniciar / cerrar sensor
  bool initSensor();
  bool closeSensor();

private:
  // variables del driver
  int m_timeoutMs;
  int m_pollIntervalMs;
  HANDLE m_deviceHandle;
  HANDLE m_dbCacheHandle;
  std::vector<unsigned char> m_imageBuffer;
  int m_imageWidth;
  int m_imageHeight;
  bool m_isInitialized;

public:
  //====Proceso de captura====

  // capturar huella y crear template
  bool captureCreateTemplate(std::vector<unsigned char> &templateData);

  // Intentar capturar huella inmediatamente (Non-blocking)
  bool captureTemplateImmediate(std::vector<unsigned char> &templateData);

  //===funciones de obtencion====

  // obtener el tamaño del template
  size_t getTemplateSize() const;

  // obtener el tamaño de la imagen
  size_t getImageSize() const;

  // obtener el ancho de la imagen
  int getImageWidth() const;

  // obtener el alto de la imagen
  int getImageHeight() const;

  // obtener el dpi de la imagen
  int getDpi() const;

  // obtener el handle del dispositivo
  void *getDeviceHandle() const;

  // obtener el handle de la base de datos
  void *getDbCacheHandle() const;

  // obtener el buffer de imagen
  const std::vector<unsigned char> &getImageBuffer() const;

  // obtener el tamaño del buffer de imagen
  size_t getImageBufferSize() const;

  // obtener datos la base de datos en el sensor
  bool DBAdd(const std::vector<unsigned char> &templateData, int userId);

  // identificar huella en la base de datos en el sensor
  bool DBIdentify(const std::vector<unsigned char> &templateData, int &userId,
                  int &score);

  //====Funciones de comparacion====

  // comparar dos templates y retornar el score de coincidencia
  int matchTemplate(const std::vector<unsigned char> &template1,
                    const std::vector<unsigned char> &template2);

  // obtener la última imagen capturada (para debug / mostrar huella en
  // pantalla)
  bool captureLastTemplate(std::vector<unsigned char> &imgOut, int &width,
                           int &height);
};

// Diferencia en la vida de una huella:
// - Capturar (Sensor): Escanear el dedo en vivo desde el aparato de ZKTeco.
// - Obtener (BD): Leer la huella guardada en el disco duro para compararla
// (Asistencia).
// - Almacenar (BD): Guardar esa huella capturada por primera vez
// (Enrolamiento).