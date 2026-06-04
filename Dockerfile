FROM python:3.12-slim

WORKDIR /app

# Herramientas de compilacion para extensiones C (httptools, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias primero (layer cacheado)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar solo el codigo fuente Python
COPY core/ ./core/
COPY infra/ ./infra/

# El sensor ZKFinger es hardware Windows-only: el backend lo detecta y arranca sin el
# HuellaService.py -> _probar_sensor() devuelve False en Linux -> modo degradado

ENV BIOPAE_DATA_DIR=/app/data
ENV TOTEM_ID=1

RUN mkdir -p /app/data

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "infra.main:app", "--host", "0.0.0.0", "--port", "8080"]
