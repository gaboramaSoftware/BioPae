//archivo para crear todas las funciones de inicio de conectividad en JavaScript
function startCerebro() {
    if (cerebroProcess) return;

    console.log("[MAIN] Iniciando Cerebro C++...");
    //mover a un archivo de constantes
    const cerebroPath = 'C:\\Digitador\\src\\Digitador.exe';

    try {
        // Iniciar con --webserver directamente (sin menú interactivo)
        cerebroProcess = spawn(cerebroPath, ['--webserver'], {
            cwd: '',
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'] // No necesitamos stdin
        });

        cerebroProcess.stdout.on('data', (data) => {
            console.log(`[C++]: ${data.toString().trim()}`);
        });

        cerebroProcess.stderr.on('data', (data) => {
            console.error(`[C++ ERR]: ${data.toString().trim()}`);
        });

        cerebroProcess.on('close', (code) => {
            console.log(`[MAIN] Cerebro terminó con código ${code}`);
            cerebroProcess = null;
        });

        cerebroProcess.on('error', (err) => {
            console.error("[MAIN] Error al iniciar Cerebro:", err);
            cerebroProcess = null;
        });

    } catch (e) {
        console.error("[MAIN] Excepción al lanzar Cerebro:", e);
    }
}