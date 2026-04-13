// src/cpp/Sensor.cpp

#include "Sensor.h"
#include "include/libzkfp.h"
#include "include/libzkfperrdef.h" //I want to export ZKFPM_DBIdentify
#include <chrono>
#include <iostream>
#include <thread>

// Si no lo tienes definido en otro lado, define el tamaño máximo de template
#ifndef MAX_TEMPLATE_SIZE
#define MAX_TEMPLATE_SIZE 2048 // Ajusta si tu SDK indica otro valor
#endif

// Constructor
Sensor::Sensor()
    : m_timeoutMs(DEFAULT_TIMEOUT_MS),
      m_pollIntervalMs(DEFAULT_POLL_INTERVAL_MS), m_deviceHandle(nullptr),
      m_dbCacheHandle(nullptr), m_imageBuffer(), m_imageWidth(0),
      m_imageHeight(0), m_isInitialized(false) {}

// Destructor
Sensor::~Sensor() { closeSensor(); }

// -----------------------------------------------------------------------------
// Inicializar sensor
// -----------------------------------------------------------------------------
bool Sensor::initSensor() {
  if (m_isInitialized) {
    return true;
  }

  // 1) Inicializar SDK PRIMERO (antes de cualquier operación con dispositivos)
  int ret = ZKFPM_Init();
  if (ret != ZKFP_ERR_OK) {
    std::cerr << "(-) Error al inicializar ZKFP, código: " << ret << std::endl;
    return false;
  }

  // 2) Ver cuántos dispositivos hay (DESPUÉS de Init)
  int devCount = ZKFPM_GetDeviceCount();
  if (devCount <= 0) {
    std::cerr << "(-) No se encontraron dispositivos de huella." << std::endl;
    ZKFPM_Terminate();
    return false;
  }

  std::cout << "(+) Dispositivos encontrados: " << devCount << std::endl;

  // 3) Abrir el primer dispositivo (índice 0)
  m_deviceHandle = ZKFPM_OpenDevice(0);
  if (!m_deviceHandle) {
    std::cerr << "(-) No se pudo abrir el dispositivo 0" << std::endl;
    ZKFPM_Terminate();
    return false;
  }

  std::cout << "(+) Dispositivo abierto correctamente" << std::endl;

  // 4) Intentar obtener ancho/alto/DPI
  int width = 0;
  int height = 0;
  int dpi = 0;

  ret = ZKFPM_GetCaptureParamsEx(m_deviceHandle, &width, &height, &dpi);
  if (ret != ZKFP_ERR_OK) {
    std::cerr << "(-) Error al obtener ancho de imagen, código: " << ret
              << std::endl;
    std::cerr << "    Usando valores por defecto 250x360 @500dpi.\n";

    // Valores por defecto razonables
    width = 250;
    height = 360;
    dpi = 500;
  }

  m_imageWidth = width;
  m_imageHeight = height;

  // Reservar buffer como vector
  const auto pixelCount =
      static_cast<size_t>(m_imageWidth) * static_cast<size_t>(m_imageHeight);
  m_imageBuffer.resize(pixelCount);

  // 5) Inicializar DB de templates
  m_dbCacheHandle = ZKFPM_DBInit();
  if (!m_dbCacheHandle) {
    std::cerr << "(-) Error al inicializar DB de huellas." << std::endl;
    m_imageBuffer.clear();
    ZKFPM_CloseDevice(m_deviceHandle);
    m_deviceHandle = nullptr;
    ZKFPM_Terminate();
    return false;
  }

  m_isInitialized = true;
  std::cout << "(+) Sensor inicializado correctamente" << std::endl;
  return true;
}

// -----------------------------------------------------------------------------
// Cerrar sensor
// -----------------------------------------------------------------------------
bool Sensor::closeSensor() {
  if (!m_isInitialized) {
    return true;
  }

  // Liberar DB de templates
  if (m_dbCacheHandle) {
    ZKFPM_DBFree(m_dbCacheHandle);
    m_dbCacheHandle = nullptr;
  }

  // Cerrar dispositivo
  if (m_deviceHandle) {
    ZKFPM_CloseDevice(m_deviceHandle);
    m_deviceHandle = nullptr;
  }

  // Limpiar buffer de imagen
  m_imageBuffer.clear();
  m_imageWidth = 0;
  m_imageHeight = 0;

  // Terminar SDK
  ZKFPM_Terminate();

  m_isInitialized = false;
  return true;
}

// -----------------------------------------------------------------------------
// Agregar template a la DB en memoria
// -----------------------------------------------------------------------------
bool Sensor::DBAdd(const std::vector<unsigned char> &templateData,
                             int userId) {
  if (!m_isInitialized || !m_dbCacheHandle) {
    std::cerr << "(-) Sensor no inicializado o DB inválida." << std::endl;
    return false;
  }

  if (templateData.empty()) {
    std::cerr << "(-) Template vacío." << std::endl;
    return false;
  }

  // Agregar template a la DB en memoria
  int ret = ZKFPM_DBAdd(m_dbCacheHandle, userId, const_cast<unsigned char*>(templateData.data()),
                        static_cast<unsigned int>(templateData.size()));

  if (ret != ZKFP_ERR_OK) {
    std::cerr << "(-) Error al agregar template a la DB, código: " << ret
              << std::endl;
    return false;
  }

  std::cout << "(+) Template agregado a la DB (ID: " << userId << ")."
            << std::endl;
  return true;
}

// -----------------------------------------------------------------------------
// Identificar huella en la DB en memoria
// -----------------------------------------------------------------------------
bool Sensor::DBIdentify(const std::vector<unsigned char> &templateData,
                        int &userId, int &score) {
  if (!m_isInitialized || !m_dbCacheHandle) {
    std::cerr << "(-) Sensor no inicializado o DB inválida." << std::endl;
    return false;
  }

  if (templateData.empty()) {
    std::cerr << "(-) Template vacío." << std::endl;
    return false;
  }

  // Identificar huella en la DB en memoria
  int ret = ZKFPM_DBIdentify(m_dbCacheHandle, const_cast<unsigned char*>(templateData.data()),
                             static_cast<unsigned int>(templateData.size()),
                             (unsigned int *)&userId, (unsigned int *)&score);

  if (ret != ZKFP_ERR_OK) {
    std::cerr << "(-) Error al identificar template, código: " << ret
              << std::endl;
    return false;
  }

  std::cout << "(+) Huella identificada en la DB (ID: " << userId
            << ", Score: " << score << ")." << std::endl;
  return true;
}

// -----------------------------------------------------------------------------
// Capturar huella y crear template
// -----------------------------------------------------------------------------
bool Sensor::captureCreateTemplate(

    // datos del template
    std::vector<unsigned char> &templateData) {

  // esta el sensor apagado?
  if (!m_isInitialized) {
    return false;
  }

  // esta el buffer de imagen grayscale sin datos?
  if (m_imageBuffer.empty()) {
    return false;
  }

  // almacenamos el template en un buffer temporal
  unsigned char templateBufferTemporal[MAX_TEMPLATE_SIZE];

  int ret = ZKFP_ERR_FAIL;
  bool success = false;
  unsigned int templateSize = 0;

  // Creamos tiempo de espera y deadline
  auto startWait = std::chrono::steady_clock::now();
  auto deadline = startWait + std::chrono::milliseconds(m_timeoutMs);

  // ciclo while para capturar la huella
  while (std::chrono::steady_clock::now() < deadline) {

    // creamos un buffer temporal para almacenar la imagen
    templateSize = MAX_TEMPLATE_SIZE; // SIEMPRE resetear

    // obtenemos el tamaño real de la imagen en bytes
    unsigned int imageSize = static_cast<unsigned int>(m_imageBuffer.size());

    // capturamos la huella capturada por el sensor
    ret = ZKFPM_AcquireFingerprint(m_deviceHandle, m_imageBuffer.data(),
                                   imageSize, templateBufferTemporal,
                                   &templateSize);

    // si la captura fue exitosa
    if (ret == ZKFP_ERR_OK) {
      success = true;
      break;
    }

// revisamos de nuevo: hay dedo en el buffer?
#ifdef ZKFP_ERR_NO_FINGER
    if (ret == ZKFP_ERR_NO_FINGER) {
      // No hay dedo: Esperamos 1s y reintentamos.
      std::this_thread::sleep_for(std::chrono::milliseconds(m_pollIntervalMs));
      continue;
    } else {
      // Error real de lectura
      return false;
    }

#else
    // si hay dedo pero el error persiste, esperamos 1s y reintentamos
    std::this_thread::sleep_for(std::chrono::milliseconds(m_pollIntervalMs));
    continue; // vuelta al while (10 veces max.)
#endif
  }

  // No hay dedo: nadie puso el dedo
  if (!success) {
    return false;
  }

  // Movemos el template al vector de salida
  templateData.assign(templateBufferTemporal,
                      templateBufferTemporal + templateSize);

  return true;
}

// -----------------------------------------------------------------------------
// Obtener la última imagen capturada
// -----------------------------------------------------------------------------
bool Sensor::captureLastTemplate(std::vector<unsigned char> &imgOut, int &width,
                                 int &height) {
  // sensor apagado?
  if (!m_isInitialized) {
    std::cerr
        << "(-) No hay imagen disponible o el sensor no está inicializado."
        << std::endl;
    return false;
  }
  // imagen vacia??
  if (m_imageBuffer.empty()) {
    std::cerr
        << "(-) No hay imagen disponible o el sensor no está inicializado."
        << std::endl;
    return false;
  }

  // definimos tamaño real
  width = m_imageWidth;
  height = m_imageHeight;

  // copiamos la imagen completamente
  imgOut = m_imageBuffer;
  return true;
}

// TODO: traspasar esto a templatemanager.cpp
//  -----------------------------------------------------------------------------
//  Comparar dos templates y retornar el score de coincidencia
//  -----------------------------------------------------------------------------
int Sensor::matchTemplate(const std::vector<unsigned char> &template1,
                          const std::vector<unsigned char> &template2) {
  // sensor inicializado?
  if (!m_isInitialized) {
    std::cerr << "(-) matchTemplate: sensor no inicializado." << std::endl;
    return -1;
  }

  // DB inicializada
  if (!m_dbCacheHandle) {
    std::cerr << "(-) matchTemplate: DB no inicializada." << std::endl;
    return -1;
  }

  // templates vacios?
  if (template1.empty() || template2.empty()) {
    std::cerr << "(-) matchTemplate: uno de los templates está vacío."
              << std::endl;
    return -1;
  }

  // Obtenemos el tamaño (cantidad de bytes) de cada huella.
  unsigned int size1 = static_cast<unsigned int>(template1.size());
  unsigned int size2 = static_cast<unsigned int>(template2.size());

  // Extraemos el puntero directo a los datos crudos en memoria.
  unsigned char *tpl1 = const_cast<unsigned char *>(template1.data());
  unsigned char *tpl2 = const_cast<unsigned char *>(template2.data());

  // Enviamos ambas huellas para que el motor de ZKTeco las compare sengun nivel
  // de coincidencia
  int score = ZKFPM_DBMatch(m_dbCacheHandle, tpl1, size1, tpl2, size2);

  // Score negativo? Error al comparar
  if (score < 0) {
    std::cerr << "(-) DBMatch: Error al comparar huellas, código: " << score
              << std::endl;
  }
  // devuelve resultado en score
  return score;
}

// -----------------------------------------------------------------------------
// Intentar capturar huella inmediatamente (Non-while) *definicion en la
// linea 290
// -----------------------------------------------------------------------------

// capturamos la huella inmediatamente
bool Sensor::captureTemplateImmediate(
    std::vector<unsigned char> &templateData) {
  if (!m_isInitialized) {
    return false;
  }
  if (m_imageBuffer.empty()) {
    return false;
  }

  // iniciamos un buffer temporal para el template inmediato
  unsigned char tempTemplateBuffer[MAX_TEMPLATE_SIZE];
  unsigned int templateSize = MAX_TEMPLATE_SIZE;
  unsigned int imageSize = static_cast<unsigned int>(m_imageBuffer.size());

  int ret =
      ZKFPM_AcquireFingerprint(m_deviceHandle, m_imageBuffer.data(), imageSize,
                               tempTemplateBuffer, &templateSize);

  if (ret == ZKFP_ERR_OK) {
    // Éxito: copiar template
    templateData.assign(tempTemplateBuffer, tempTemplateBuffer + templateSize);
    return true;
  }

  return false;
}

// Diferencia en la vida de una huella:
// - Capturar (Sensor): Escanear el dedo en vivo desde el aparato de ZKTeco.
// - Obtener (BD): Leer la huella guardada en el disco duro para compararla
// (Asistencia).
// - Almacenar (BD): Guardar esa huella capturada por primera vez
// (Enrolamiento).