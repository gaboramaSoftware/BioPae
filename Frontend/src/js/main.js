const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs   = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess = null;

// ============================================
// DETECCIÓN DINÁMICA DE PYTHON
// ============================================

/**
 * Busca el ejecutable de Python en orden de prioridad:
 * 1. venv del proyecto (dentro de los recursos empaquetados)
 * 2. Instalaciones estándar de Windows (AppData y Program Files)
 * 3. Comando "python" del PATH del sistema como último recurso
 */
function encontrarPython(raizBackend) {
    const localAppData = process.env.LOCALAPPDATA || '';
    const candidatos = [
        // 1. Python embeddable empaquetado con la app (producción — portable)
        path.join(raizBackend, 'infra', 'python-embed', 'python.exe'),
        // 2. Venv local del proyecto (desarrollo)
        path.join(raizBackend, 'infra', 'venv', 'Scripts', 'python.exe'),
        path.join(raizBackend, 'venv', 'Scripts', 'python.exe'),
        // 3. Python instalado en AppData del usuario
        path.join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe'),
        path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'),
        path.join(localAppData, 'Programs', 'Python', 'Python310', 'python.exe'),
        // 4. Python instalado en Program Files (instalación para todos los usuarios)
        'C:\\Program Files\\Python312\\python.exe',
        'C:\\Program Files\\Python311\\python.exe',
        'C:\\Program Files\\Python310\\python.exe',
        'C:\\Python312\\python.exe',
        'C:\\Python311\\python.exe',
        'C:\\Python310\\python.exe',
    ];

    for (const ruta of candidatos) {
        if (ruta && fs.existsSync(ruta)) {
            console.log(`[MAIN] Python encontrado: ${ruta}`);
            return ruta;
        }
    }

    console.log('[MAIN] Python no encontrado en rutas conocidas, usando "python" del PATH');
    return 'python';
}

// ============================================
// LANZAR SERVIDOR FASTAPI (PYTHON)
// ============================================

function iniciarServidor() {
    // En producción los archivos Python están en process.resourcesPath/backend/
    // En desarrollo son 3 niveles arriba de js/ (raíz del repositorio)
    const proyectoRaiz = app.isPackaged
        ? path.join(process.resourcesPath, 'backend')
        : path.join(__dirname, '..', '..', '..');

    const pythonExe = encontrarPython(proyectoRaiz);

    // En producción la DB va a %APPDATA%\BioPAE\ (carpeta escribible).
    // En desarrollo no se setea → IniciarDB.py usa el comportamiento actual.
    const dataDir = app.isPackaged ? app.getPath('userData') : null;

    console.log('[MAIN] Iniciando servidor FastAPI...');
    console.log('[MAIN] Directorio del proyecto:', proyectoRaiz);
    console.log('[MAIN] Python:', pythonExe);
    if (dataDir) console.log('[MAIN] BIOPAE_DATA_DIR:', dataDir);

    pythonProcess = spawn(pythonExe, ['-m', 'uvicorn', 'infra.main:app', '--port', '8080'], {
        cwd: proyectoRaiz,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: {
            ...process.env,
            ...(dataDir ? { BIOPAE_DATA_DIR: dataDir } : {})
        }
    });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[PYTHON]: ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        // uvicorn escribe logs en stderr normalmente, no es necesariamente un error
        console.log(`[PYTHON]: ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[MAIN] Servidor Python terminó con código ${code}`);
        pythonProcess = null;
    });

    pythonProcess.on('error', (err) => {
        console.error('[MAIN] Error al iniciar servidor Python:', err.message);
        pythonProcess = null;
    });
}

// ============================================
// ESPERAR QUE EL SERVIDOR ESTÉ LISTO
// ============================================

async function esperarServidor(maxIntentos = 30) {
    console.log('[MAIN] Esperando que el servidor esté listo...');

    for (let i = 0; i < maxIntentos; i++) {
        const listo = await new Promise((resolve) => {
            const req = http.get('http://127.0.0.1:8080/api/db/status', (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(2000, () => { req.destroy(); resolve(false); });
        });

        if (listo) {
            console.log('[MAIN] ✓ Servidor listo!');
            return true;
        }

        console.log(`[MAIN] Esperando... (${i + 1}/${maxIntentos})`);
        await new Promise(r => setTimeout(r, 1000));
    }

    console.error('[MAIN] ✗ El servidor no respondió a tiempo');
    return false;
}

// ============================================
// CREAR VENTANA PRINCIPAL (TOTEM)
// ============================================

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().size;

    mainWindow = new BrowserWindow({
        width,
        height,
        fullscreen: process.argv.includes('--kiosk'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        autoHideMenuBar: true,
        backgroundColor: '#1a1a1a'
    });

    // Cargar el totem (index.html en la raíz de src/)
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

    if (!process.argv.includes('--kiosk')) {
        mainWindow.webContents.openDevTools();
    }
}

// ============================================
// INICIO
// ============================================

app.whenReady().then(async () => {
    console.log('==========================================');
    console.log('[MAIN] Iniciando BioPAE Totem...');
    console.log('==========================================');

    // 1. Lanzar el servidor Python
    iniciarServidor();

    // 2. Esperar que responda
    await esperarServidor();

    // 3. Abrir la ventana (con o sin servidor listo, el renderer muestra el error)
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// ============================================
// CIERRE LIMPIO
// ============================================

app.on('window-all-closed', () => {
    // Matar el servidor Python al cerrar Electron
    if (pythonProcess) {
        console.log('[MAIN] Cerrando servidor Python...');
        pythonProcess.kill();
    }
    if (process.platform !== 'darwin') app.quit();
});

// ============================================
// IPC
// ============================================

ipcMain.on('app:close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.on('app:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('app:reload', () => { if (mainWindow) mainWindow.reload(); });

ipcMain.handle('auth:login', async (event, args) => {
    const { rut, password } = args || {};
    return new Promise((resolve) => {
        const payload = JSON.stringify({ rut, password });
        const options = {
            hostname: '127.0.0.1',
            port: 8080,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve({ success: false, error: 'Error al procesar respuesta' }); }
            });
        });
        req.on('error', () => resolve({ success: false, error: 'Error de conexión con el servidor' }));
        req.write(payload);
        req.end();
    });
});
