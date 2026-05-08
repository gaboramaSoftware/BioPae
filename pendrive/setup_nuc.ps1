#Requires -RunAsAdministrator
# =============================================================================
#  BioPAE Totem - setup_nuc.ps1
#
#  Instala TODAS las dependencias del sistema antes de BioPAE Totem.
#  Ejecutar con clic derecho -> "Ejecutar con PowerShell como Administrador"
#
#  Estructura esperada (pendrive o carpeta de instalacion):
#    setup_nuc.ps1
#    ZKFingerSDK_setup.exe      <- en la misma carpeta
#    BioPAE Totem Setup 1.0.0.exe
#    vc_redist.x64.exe          <- opcional, evita descarga desde internet
# =============================================================================

$ErrorActionPreference = "Continue"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step($n, $text) {
    Write-Host ""
    Write-Host "[$n/4] $text" -ForegroundColor Yellow
}
function Write-OK($t)   { Write-Host "  [ OK ]  $t" -ForegroundColor Green }
function Write-Warn($t) { Write-Host "  [ !! ]  $t" -ForegroundColor Yellow }
function Write-Fail($t) { Write-Host "  [ XX ]  $t" -ForegroundColor Red }

Clear-Host
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   BioPAE Totem - Configuracion de NUC   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Instala las dependencias del sistema.   "
Write-Host "  Ejecutar UNA VEZ por NUC.               "
Write-Host "==========================================" -ForegroundColor Cyan


# =============================================================================
# 1. VISUAL C++ REDISTRIBUTABLE 2015-2022 x64
#    libzkfp.dll necesita VCRUNTIME140.dll para cargarse en Python.
#    Sin esto falla silenciosamente aunque el DLL exista en disco.
#    FIX: usar -like en vez de -match (evita bug de PowerShell con regex -and multilinea)
#    FIX: buscar x64 especificamente, x86 no es suficiente
# =============================================================================
Write-Step 1 "Visual C++ Redistributable 2015-2022 x64"

$vcpp = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*","HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Visual C++*' -and $_.DisplayVersion -ge '14.0' -and $_.DisplayName -notlike '*X86*' } | Select-Object -First 1

if ($vcpp) {
    Write-OK "Ya instalado: $($vcpp.DisplayName) v$($vcpp.DisplayVersion)"
} else {
    # FIX: intentar primero desde copia local en el pendrive (sin necesitar internet)
    $vcLocalPath = Join-Path $SCRIPT_DIR "vc_redist.x64.exe"
    if (Test-Path $vcLocalPath) {
        Write-Host "  Instalando desde copia local..." -ForegroundColor Yellow
        $proc = Start-Process -FilePath $vcLocalPath -ArgumentList "/install /quiet /norestart" -PassThru -Wait
    } else {
        Write-Warn "No encontrado localmente. Descargando desde Microsoft..."
        $tmp = "$env:TEMP\vc_redist.x64.exe"
        try {
            (New-Object System.Net.WebClient).DownloadFile("https://aka.ms/vs/17/release/vc_redist.x64.exe", $tmp)
            $proc = Start-Process -FilePath $tmp -ArgumentList "/install /quiet /norestart" -PassThru -Wait
        } catch {
            Write-Fail "No se pudo descargar. Incluye vc_redist.x64.exe en la misma carpeta que este script."
            $proc = $null
        }
    }
    if ($proc -and ($proc.ExitCode -eq 0 -or $proc.ExitCode -eq 3010)) {
        Write-OK "Instalado correctamente."
        if ($proc.ExitCode -eq 3010) { Write-Warn "Requiere reinicio al final." }
    } elseif ($proc) {
        Write-Fail "El instalador retorno codigo $($proc.ExitCode)."
    }
}


# =============================================================================
# 2. ZKFINGER SDK - driver del lector biometrico SLK20R
#    FIX: detectar el SLK20R por VID/PID especifico (VID_1B55&PID_0120)
#         en vez de por nombre generico, que confunde con el sensor interno Betterlife
# =============================================================================
Write-Step 2 "Driver del lector biometrico ZKTeco SLK20R"

$slk20r = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -like '*VID_1B55*PID_0120*' } | Select-Object -First 1

if ($slk20r) {
    Write-Host "  SLK20R detectado: $($slk20r.FriendlyName) [$($slk20r.Status)]" -ForegroundColor Cyan
} else {
    Write-Warn "SLK20R no detectado en USB. Conectalo antes de instalar el driver si es posible."
}

$candidatos = @(
    "$SCRIPT_DIR\ZKFingerSDK_setup.exe",
    "$SCRIPT_DIR\setup.exe",
    "$SCRIPT_DIR\deps\ZKFingerSDK_setup.exe",
    "$SCRIPT_DIR\..\deps\ZKFingerSDK_setup.exe",
    "$SCRIPT_DIR\..\resources\setup\ZKFingerSDK_setup.exe"
)

$sdk = $null
foreach ($c in $candidatos) {
    if (Test-Path $c) { $sdk = (Resolve-Path $c).Path; break }
}

if ($sdk) {
    Write-Host "  Instalador encontrado: $sdk" -ForegroundColor Cyan
    Write-Host "  Ejecutando instalador del ZKFinger SDK..." -ForegroundColor Yellow
    Write-Host "  (Se ejecuta siempre para garantizar el driver correcto de ZKTeco)" -ForegroundColor DarkGray
    Start-Process -FilePath $sdk -Wait
    Write-OK "Instalador ejecutado. Verifica que finalizo correctamente."
} else {
    Write-Fail "Instalador ZKFingerSDK_setup.exe no encontrado."
    Write-Host ""
    Write-Host "  Coloca ZKFingerSDK_setup.exe en la misma carpeta que este script." -ForegroundColor Yellow
    Read-Host "  Presiona Enter para cerrar"
    exit 1
}


# =============================================================================
# 3. TOTEM_ID
#    Identifica que NUC es este: 1 = Basica | 2 = Media
# =============================================================================
Write-Step 3 "TOTEM_ID - identidad de este NUC"

$actual = [Environment]::GetEnvironmentVariable("TOTEM_ID", "Machine")
$configurar = $true

if ($actual) {
    Write-OK "TOTEM_ID ya configurado: $actual"
    $resp = Read-Host "  Cambiar? (S/N)"
    $configurar = $resp -match "^[Ss]$"
}

if ($configurar) {
    Write-Host ""
    Write-Host "  Que NUC es este?" -ForegroundColor Cyan
    Write-Host "  [1] Basica"
    Write-Host "  [2] Media"
    $id = Read-Host "  Numero"
    if ($id -match "^\d+$") {
        [Environment]::SetEnvironmentVariable("TOTEM_ID", $id, "Machine")
        Write-OK "TOTEM_ID=$id guardado en el sistema."
    } else {
        Write-Fail "Valor invalido. TOTEM_ID no fue configurado."
    }
}


# =============================================================================
# 4. VERIFICACION FINAL
#    FIX: verificar VC++ con -like (evita bug de regex multilinea)
#    FIX: verificar SLK20R por VID/PID, ignorar Betterlife interno
# =============================================================================
Write-Step 4 "Verificacion final"

$vcpp_ok = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*","HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Visual C++*' -and $_.DisplayVersion -ge '14.0' -and $_.DisplayName -notlike '*X86*' } | Select-Object -First 1

$dev_ok = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -like '*VID_1B55*PID_0120*' } | Select-Object -First 1

$totem_ok = [Environment]::GetEnvironmentVariable("TOTEM_ID", "Machine")

$todo_verde = $true

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   RESULTADO FINAL                        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if ($vcpp_ok) {
    Write-OK "Visual C++ x64 instalado ($($vcpp_ok.DisplayVersion))"
} else {
    Write-Fail "Visual C++ x64 NO instalado"
    $todo_verde = $false
}

if ($dev_ok -and $dev_ok.Status -eq "OK") {
    Write-OK "Lector SLK20R: OK (VID_1B55&PID_0120)"
} elseif ($dev_ok) {
    Write-Warn "Lector SLK20R detectado pero Status '$($dev_ok.Status)' - reinicia si recien instalaste el driver"
    $todo_verde = $false
} else {
    Write-Fail "Lector SLK20R no detectado (desconectado o driver no instalado)"
    $todo_verde = $false
}

if ($totem_ok) {
    Write-OK "TOTEM_ID = $totem_ok"
} else {
    Write-Fail "TOTEM_ID no configurado"
    $todo_verde = $false
}

Write-Host ""
Write-Host "  NOTA: El sensor interno Betterlife del NUC puede aparecer como Unknown." -ForegroundColor DarkGray
Write-Host "        Eso es normal y no afecta a BioPAE." -ForegroundColor DarkGray

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
if ($todo_verde) {
    Write-Host "  TODO OK - Ejecuta BioPAE Totem Setup   " -ForegroundColor Green
} else {
    Write-Host "  HAY PROBLEMAS - Revisa los items [XX]  " -ForegroundColor Red
    Write-Host "  antes de instalar BioPAE Totem.        " -ForegroundColor Red
}
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Presiona Enter para cerrar"
