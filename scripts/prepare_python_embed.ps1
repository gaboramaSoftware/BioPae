# =============================================================================
# prepare_python_embed.ps1
# Prepara un Python 3.12 embeddable + todos los paquetes de produccion
# en infra/python-embed/, listo para ser empaquetado por electron-builder.
#
# Ejecutar UNA VEZ en la maquina de desarrollo antes de hacer el build:
#   cd C:\Proyectos\Pydigitador
#   .\scripts\prepare_python_embed.ps1
#
# Requiere: internet, PowerShell 5+
# =============================================================================

$ErrorActionPreference = "Stop"

$PYTHON_VERSION  = "3.12.10"
$PYTHON_URL      = "https://www.python.org/ftp/python/$PYTHON_VERSION/python-$PYTHON_VERSION-embed-amd64.zip"
$GET_PIP_URL     = "https://bootstrap.pypa.io/get-pip.py"

$ROOT       = Split-Path $PSScriptRoot -Parent
$EMBED_DIR  = Join-Path $ROOT "infra\python-embed"
$REQ_FILE   = Join-Path $ROOT "requirements.txt"
$TEMP_ZIP   = Join-Path $env:TEMP "python-embed-amd64.zip"
$TEMP_PIP   = Join-Path $env:TEMP "get-pip.py"

# --- 1. Verificar que existe requirements.txt --------------------------------
if (-not (Test-Path $REQ_FILE)) {
    Write-Error "No se encontro requirements.txt en $ROOT"
    exit 1
}

# --- 2. Limpiar instalacion previa si existe ---------------------------------
if (Test-Path $EMBED_DIR) {
    Write-Host "[1/6] Limpiando instalacion anterior en $EMBED_DIR ..." -ForegroundColor Yellow
    Remove-Item $EMBED_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $EMBED_DIR | Out-Null

# --- 3. Descargar Python embeddable ------------------------------------------
Write-Host "[2/6] Descargando Python $PYTHON_VERSION embeddable..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $PYTHON_URL -OutFile $TEMP_ZIP -UseBasicParsing

# --- 4. Extraer --------------------------------------------------------------
Write-Host "[3/6] Extrayendo en $EMBED_DIR ..." -ForegroundColor Cyan
Expand-Archive -Path $TEMP_ZIP -DestinationPath $EMBED_DIR -Force

# --- 5. Habilitar site-packages en el .pth -----------------------------------
# El archivo python312._pth controla sys.path.
# Por defecto trae "#import site" comentado -- lo descomentamos para que pip
# y los paquetes instalados en Lib\site-packages sean encontrados.
Write-Host "[4/6] Habilitando site-packages..." -ForegroundColor Cyan

$pthFile = Join-Path $EMBED_DIR "python312._pth"
if (-not (Test-Path $pthFile)) {
    Write-Error "No se encontro $pthFile. Verifica que el zip es el correcto."
    exit 1
}

$pthContent = Get-Content $pthFile -Raw
$pthContent = $pthContent -replace '#import site', 'import site'
if ($pthContent -notmatch 'Lib\\site-packages') {
    $pthContent = $pthContent.TrimEnd() + "`r`nLib\site-packages`r`n"
}
Set-Content -Path $pthFile -Value $pthContent -NoNewline:$false

# --- 6. Instalar pip ---------------------------------------------------------
Write-Host "[5/6] Instalando pip..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $GET_PIP_URL -OutFile $TEMP_PIP -UseBasicParsing

$pythonExe = Join-Path $EMBED_DIR "python.exe"
& $pythonExe $TEMP_PIP --no-warn-script-location 2>&1 | Write-Host

# --- 7. Instalar paquetes de produccion --------------------------------------
Write-Host "[6/6] Instalando paquetes desde requirements.txt..." -ForegroundColor Cyan
& $pythonExe -m pip install `
    --no-warn-script-location `
    --no-cache-dir `
    -r $REQ_FILE `
    2>&1 | Write-Host

# --- 8. Copiar sensorWrapper y DLLs de ZKTeco --------------------------------
# Se colocan junto a python.exe para que:
#   - El .pyd sea importable (el .pth ya tiene "." = directorio de python.exe en sys.path)
#   - Las DLLs sean encontradas por Windows al cargar el .pyd
Write-Host ""
Write-Host "Copiando sensorWrapper y DLLs de ZKTeco..." -ForegroundColor Cyan

$PYD_SRC = Join-Path $ROOT "sensorWrapper.cp312-win_amd64.pyd"
$DLL_DIR  = Join-Path $ROOT "infra\Hardware\bin"

if (-not (Test-Path $PYD_SRC)) {
    Write-Error "No se encontro sensorWrapper.cp312-win_amd64.pyd en $ROOT"
    exit 1
}
if (-not (Test-Path $DLL_DIR)) {
    Write-Error "No se encontro infra\Hardware\bin\ en $ROOT"
    exit 1
}

Copy-Item $PYD_SRC $EMBED_DIR -Force
Copy-Item "$DLL_DIR\libzkfp.dll"          $EMBED_DIR -Force
Copy-Item "$DLL_DIR\libcrypto-3-x64.dll"  $EMBED_DIR -Force
Copy-Item "$DLL_DIR\libssl-3-x64.dll"     $EMBED_DIR -Force

Write-Host "  -> sensorWrapper.cp312-win_amd64.pyd" -ForegroundColor Gray
Write-Host "  -> libzkfp.dll" -ForegroundColor Gray
Write-Host "  -> libcrypto-3-x64.dll" -ForegroundColor Gray
Write-Host "  -> libssl-3-x64.dll" -ForegroundColor Gray

# --- Verificacion final -------------------------------------------------------
Write-Host ""
Write-Host "Verificando instalacion..." -ForegroundColor Cyan

$testPaquetes = & $pythonExe -c "import fastapi, uvicorn, sqlalchemy, openpyxl; print('OK')" 2>&1
$testSensor   = & $pythonExe -c "import sensorWrapper; print('OK')" 2>&1

$errores = @()
if ($testPaquetes -ne "OK") { $errores += "Paquetes pip: $testPaquetes" }
if ($testSensor   -ne "OK") { $errores += "sensorWrapper: $testSensor" }

if ($errores.Count -eq 0) {
    Write-Host ""
    Write-Host "[OK] Python embeddable listo en: $EMBED_DIR" -ForegroundColor Green
    Write-Host "     Siguiente paso: cd Frontend/src" -ForegroundColor Green
    Write-Host "     Luego correr:   npm run build" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ERROR] Verificacion fallida:" -ForegroundColor Red
    foreach ($e in $errores) { Write-Host "  $e" -ForegroundColor Red }
    exit 1
}
