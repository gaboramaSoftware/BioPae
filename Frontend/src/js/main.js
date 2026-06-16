const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
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

    // La DB siempre va a %APPDATA%\[AppName]\ (carpeta escribible en cualquier usuario Windows).
    // app.getPath('userData') funciona tanto en desarrollo como en producción empaquetada.
    const dataDir = app.getPath('userData');

    console.log('[MAIN] Iniciando servidor FastAPI...');
    console.log('[MAIN] app.isPackaged:', app.isPackaged);
    console.log('[MAIN] Directorio del proyecto:', proyectoRaiz);
    console.log('[MAIN] Python:', pythonExe);
    console.log('[MAIN] BIOPAE_DATA_DIR:', dataDir);

    pythonProcess = spawn(pythonExe, ['-m', 'uvicorn', 'infra.main:app', '--host', '0.0.0.0', '--port', '8080'], {
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
    const rol = (process.env.BIOPAE_ROLE || '').toLowerCase();
    const esTotem = rol === 'totem' || process.argv.includes('--kiosk');
    const esAdmin = rol === 'admin';

    mainWindow = new BrowserWindow({
        width,
        height,
        fullscreen: esTotem,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        autoHideMenuBar: true,
        backgroundColor: '#1a1a1a'
    });

    if (esAdmin) {
        mainWindow.loadFile(path.join(__dirname, '..', 'index', 'auth.html'));
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
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
    // Comportamiento de Kiosco: Forzar cierre total inmediato sin excepciones
    app.quit();
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

// ============================================
// CONTROL DE RESPALDOS SQL (EXPORTACIÓN / IMPORTACIÓN)
// ============================================

const BACKEND_DB_URL = 'http://127.0.0.1:8080/api/database';

ipcMain.handle('database:export', async () => {
    // 1. Abrir diálogo nativo del S.O. para guardar el archivo .sql
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exportar Base de Datos',
        defaultPath: path.join(app.getPath('downloads'), `backup_biopae_${Date.now()}.sql`),
        filters: [{ name: 'Archivos SQL', extensions: ['sql'] }]
    });

    if (canceled || !filePath) return { success: false, message: 'Exportación cancelada por el usuario' };

    try {
        // 2. Consumir el dump generado por FastAPI
        const response = await fetch(`${BACKEND_DB_URL}/export`);
        if (!response.ok) throw new Error('El backend devolvió un estado erróneo al exportar');

        const sqlText = await response.text();
        
        // 3. Guardar el archivo en el volumen físico elegido
        fs.writeFileSync(filePath, sqlText, 'utf-8');
        return { success: true, message: `Copia de seguridad almacenada en: ${filePath}` };
    } catch (error) {
        return { success: false, message: `Error en la exportación: ${error.message}` };
    }
});

ipcMain.handle('database:import', async () => {
    // 1. Abrir diálogo nativo del S.O. para seleccionar el archivo .sql
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Seleccionar Archivo de Respaldo SQL',
        filters: [{ name: 'Archivos SQL', extensions: ['sql'] }],
        properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) return { success: false, message: 'Importación cancelada por el usuario' };
    const filePath = filePaths[0];

    try {
        // 2. Leer los datos binarios locales del archivo elegido
        const fileBuffer = fs.readFileSync(filePath);
        const nombreArchivo = path.basename(filePath);
        
        // 3. Utilizar el constructor File nativo para conservar los metadatos exactos del archivo
        const fileObject = new File([fileBuffer], nombreArchivo, { type: 'application/sql' });
        
        const formData = new FormData();
        formData.append('file', fileObject);

        // 4. Enviar el script SQL al backend
        const response = await fetch(`${BACKEND_DB_URL}/import`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Error interno durante el procesamiento del archivo SQL');

        return { success: true, message: '¡Estructura y registros añadidos de forma correcta al sistema!' };
    } catch (error) {
        return { success: false, message: `Fallo crítico de importación: ${error.message}` };
    }
});

async function exportarBaseDatos() {
    // Llama al canal del proceso Main que ya dejamos listo
    const resultado = await window.electron.ipcRenderer.invoke('database:export');
    alert(resultado.message);
}

async function importarBaseDatos() {
    if (confirm("¿Estás seguro? Cargar una nueva base de datos reemplazará los registros actuales.")) {
        const resultado = await window.electron.ipcRenderer.invoke('database:import');
        alert(resultado.message);
        if (resultado.success) {
            location.reload(); // Recarga la UI para ver los nuevos datos reflejados
        }
    }
}