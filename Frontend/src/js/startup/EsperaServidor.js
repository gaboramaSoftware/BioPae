// Esperar a que el servidor esté listo
async function EsperaServidor(maxAttempts = 30) {
    console.log("[MAIN] Esperando a que el servidor C++ esté listo...");

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const ready = await new Promise((resolve, reject) => {
                const req = http.get('http://localhost:8080/api/sensor/status', (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve(json.available === true);
                        } catch (e) {
                            resolve(false);
                        }
                    });
                });
                req.on('error', () => resolve(false));
                req.setTimeout(2000, () => {
                    req.destroy();
                    resolve(false);
                });
            });

            if (ready) {
                console.log("[MAIN] ✓ Servidor C++ listo!");
                return true;
            }
        } catch (e) {
            // Ignorar errores, seguir intentando
        }

        console.log(`[MAIN] Esperando servidor... (${i + 1}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, 1000));
    }

    console.error("[MAIN] ✗ Servidor no respondió");
    return false;
}