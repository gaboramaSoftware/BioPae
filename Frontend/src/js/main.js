const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess = null;

// ============================================
// LANZAR SERVIDOR FASTAPI (PYTHON)
// ============================================

function iniciarServidor() {
    // Ruta al directorio raíz del proyecto (2 niveles arriba de js/)
    const proyectoRaiz = path.join(__dirname, '..', '..', '..');

    // Buscar python en las rutas más comunes de Windows
    const pythonPaths = [
        'C:\\Users\\fabio\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
        'python',
        'python3'
    ];

    const pythonExe = pythonPaths[0]; // Usar la ruta directa del sistema

    console.log('[MAIN] Iniciando servidor FastAPI...');
    console.log('[MAIN] Directorio del proyecto:', proyectoRaiz);

    pythonProcess = spawn(pythonExe, ['-m', 'uvicorn', 'infra.main:app', '--port', '8080'], {
        cwd: proyectoRaiz,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
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
    if (rut === '11111111' && password === 'admin123') {
        return { success: true, role: 'admin' };
    }
    return { success: false, error: 'Credenciales inválidas' };
});
