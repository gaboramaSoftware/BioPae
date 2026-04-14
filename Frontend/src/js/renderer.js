const API_URL = 'http://localhost:8080';
const WS_URL = 'ws://localhost:8080';
let autoReturnTimeout = null;
let activeWs = null;
let enrollWs = null;

// ============================================
// CURSOS (generado por CursoService.py)
// ============================================
const CURSOS = {
    "pre-kinder_a":"Pre-Kinder A","pre-kinder_b":"Pre-Kinder B","pre-kinder_c":"Pre-Kinder C",
    "pre-kinder_d":"Pre-Kinder D","pre-kinder_e":"Pre-Kinder E","pre-kinder_f":"Pre-Kinder F",
    "kinder_a":"Kinder A","kinder_b":"Kinder B","kinder_c":"Kinder C",
    "kinder_d":"Kinder D","kinder_e":"Kinder E","kinder_f":"Kinder F",
    "1_basico_a":"1 Basico A","1_basico_b":"1 Basico B","1_basico_c":"1 Basico C",
    "1_basico_d":"1 Basico D","1_basico_e":"1 Basico E","1_basico_f":"1 Basico F",
    "2_basico_a":"2 Basico A","2_basico_b":"2 Basico B","2_basico_c":"2 Basico C",
    "2_basico_d":"2 Basico D","2_basico_e":"2 Basico E","2_basico_f":"2 Basico F",
    "3_basico_a":"3 Basico A","3_basico_b":"3 Basico B","3_basico_c":"3 Basico C",
    "3_basico_d":"3 Basico D","3_basico_e":"3 Basico E","3_basico_f":"3 Basico F",
    "4_basico_a":"4 Basico A","4_basico_b":"4 Basico B","4_basico_c":"4 Basico C",
    "4_basico_d":"4 Basico D","4_basico_e":"4 Basico E","4_basico_f":"4 Basico F",
    "5_basico_a":"5 Basico A","5_basico_b":"5 Basico B","5_basico_c":"5 Basico C",
    "5_basico_d":"5 Basico D","5_basico_e":"5 Basico E","5_basico_f":"5 Basico F",
    "6_basico_a":"6 Basico A","6_basico_b":"6 Basico B","6_basico_c":"6 Basico C",
    "6_basico_d":"6 Basico D","6_basico_e":"6 Basico E","6_basico_f":"6 Basico F",
    "7_basico_a":"7 Basico A","7_basico_b":"7 Basico B","7_basico_c":"7 Basico C",
    "7_basico_d":"7 Basico D","7_basico_e":"7 Basico E","7_basico_f":"7 Basico F",
    "8_basico_a":"8 Basico A","8_basico_b":"8 Basico B","8_basico_c":"8 Basico C",
    "8_basico_d":"8 Basico D","8_basico_e":"8 Basico E","8_basico_f":"8 Basico F",
    "1_medio_a":"1 Medio A","1_medio_b":"1 Medio B","1_medio_c":"1 Medio C",
    "1_medio_d":"1 Medio D","1_medio_e":"1 Medio E","1_medio_f":"1 Medio F",
    "2_medio_a":"2 Medio A","2_medio_b":"2 Medio B","2_medio_c":"2 Medio C",
    "2_medio_d":"2 Medio D","2_medio_e":"2 Medio E","2_medio_f":"2 Medio F",
    "3_medio_a":"3 Medio A","3_medio_b":"3 Medio B","3_medio_c":"3 Medio C",
    "3_medio_d":"3 Medio D","3_medio_e":"3 Medio E","3_medio_f":"3 Medio F",
    "4_medio_a":"4 Medio A","4_medio_b":"4 Medio B","4_medio_c":"4 Medio C",
    "4_medio_d":"4 Medio D","4_medio_e":"4 Medio E","4_medio_f":"4 Medio F"
};

const screens = {
    waiting: document.getElementById('screen-waiting'),
    processing: document.getElementById('screen-processing'),
    approved: document.getElementById('screen-approved'),
    rejected: document.getElementById('screen-rejected')
};

// ============================================
// GESTIÓN DE PANTALLAS
// ============================================

function showScreen(screenName) {
    Object.entries(screens).forEach(([, screen]) => {
        if (screen) screen.classList.remove('active');
    });
    if (screens[screenName]) screens[screenName].classList.add('active');
    if (autoReturnTimeout) {
        clearTimeout(autoReturnTimeout);
        autoReturnTimeout = null;
    }
}

function autoReturnToWaiting(delayMs = 5000) {
    autoReturnTimeout = setTimeout(() => activarSensor(), delayMs);
}

// ============================================
// MOSTRAR RESULTADOS
// ============================================

function mostrarAprobado(data) {
    document.getElementById('approved-nombre').textContent = data?.nombre || 'N/A';
    document.getElementById('approved-run').textContent   = data?.rut || data?.run || 'N/A';
    document.getElementById('approved-curso').textContent = data?.curso || 'N/A';
    
    // FIX PUNTO 9: Capitalizar la primera letra del tipo_racion
    const racionRaw = data?.tipo_racion || 'N/A';
    const racionCapitalizada = racionRaw !== 'N/A' 
        ? racionRaw.charAt(0).toUpperCase() + racionRaw.slice(1).toLowerCase() 
        : 'N/A';
        
    document.getElementById('approved-racion').textContent = racionCapitalizada;

    const paeEl = document.getElementById('approved-pae');
    if (paeEl) paeEl.textContent = data?.es_pae ? 'PAE' : 'No PAE';

    showScreen('approved');
    autoReturnToWaiting(800);
}

function mostrarRechazado(razon, nombre = '') {
    document.getElementById('rejected-reason').textContent = razon;
    document.getElementById('rejected-nombre').textContent = nombre;
    showScreen('rejected');
    autoReturnToWaiting(800);
}

// ============================================
// FLUJO PRINCIPAL
// ============================================

async function activarSensor() {
    // Cerrar conexión anterior si existe
    if (activeWs) {
        activeWs.onclose = null; // evitar que onclose reactive activarSensor
        activeWs.close();
        activeWs = null;
    }

    showScreen('waiting');

    const ws = new WebSocket(`${WS_URL}/ws/totem`);
    activeWs = ws;
    let responded = false;

    ws.onmessage = (event) => {
        responded = true;
        activeWs = null;
        const data = JSON.parse(event.data);
        if (data.estado === 'Aprobado') {
            mostrarAprobado({ ...data.alumno, tipo_racion: data.tipo_racion });
        } else {
            mostrarRechazado(data.mensaje, data.alumno?.nombre || '');
        }
    };

    ws.onerror = () => {
        if (!responded) {
            activeWs = null;
            mostrarRechazado('Error de conexion', 'Verifique que el servidor este activo');
        }
    };

    ws.onclose = () => {
        if (!responded) {
            activeWs = null;
            // Debounce: esperar 500ms antes de reconectar para evitar cadena de conexiones
            setTimeout(() => activarSensor(), 500);
        }
    };
}

// ============================================
// INICIALIZACION
// ============================================

async function inicializar() {
    showScreen('waiting');

    let intentos = 0;
    while (intentos < 30) {
        try {
            const res = await fetch(`${API_URL}/api/sensor/status`);
            const data = await res.json();
            if (data.available === true) break;
        } catch {}
        intentos++;
        await new Promise(r => setTimeout(r, 1000));
    }

    if (intentos >= 30) {
        mostrarRechazado('Error de conexion', 'No se pudo conectar al servidor');
        return;
    }

    activarSensor();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
} else {
    inicializar();
}

window.addEventListener('beforeunload', () => {
    if (activeWs) activeWs.close();
    if (enrollWs) enrollWs.close();
});

// ============================================
// UTILIDADES RUT
// ============================================

function generarRutAleatorio() {
    const base = Math.floor(Math.random() * 90000000) + 10000000;
    let suma = 0;
    let multiplicador = 2;
    let numeroTemp = base;

    while (numeroTemp > 0) {
        suma += (numeroTemp % 10) * multiplicador;
        numeroTemp = Math.floor(numeroTemp / 10);
        multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto = suma % 11;
    const dvCalculado = 11 - resto;
    let dv = dvCalculado === 11 ? '0' : dvCalculado === 10 ? 'K' : dvCalculado.toString();

    return `${base}-${dv}`;
}

function validarRut(rutCompleto) {
    rutCompleto = rutCompleto.replace(/[.\-]/g, '');
    if (rutCompleto.length < 2) return false;

    let cuerpo = rutCompleto.slice(0, -1);
    let dv = rutCompleto.slice(-1).toLowerCase();

    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo.charAt(i)) * multiplo;
        multiplo = multiplo < 7 ? multiplo + 1 : 2;
    }

    let dvEsperado = 11 - (suma % 11);
    dvEsperado = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'k' : dvEsperado.toString();

    return dvEsperado === dv;
}

// ============================================
// FLUJO DE REGISTRO DESDE TÓTEM
// ============================================

let enrollCurrentUserId = null;
let enrollCursosData = [];
let capturedHuellaHex = null;
let enrollRutIngresado = null;
let pendingEnrollConfirm = null;

function mostrarEnrollStep(stepId) {
    document.querySelectorAll('.enroll-step').forEach(s => s.style.display = 'none');
    document.getElementById(stepId).style.display = 'flex';
    document.getElementById('overlay-enroll').style.display = 'flex';
}

function cancelarRegistro() {
    document.getElementById('overlay-enroll').style.display = 'none';
    document.querySelectorAll('.enroll-step').forEach(s => s.style.display = 'none');
    if (enrollWs) { enrollWs.onclose = null; enrollWs.close(); enrollWs = null; }
    enrollCurrentUserId = null;
    capturedHuellaHex = null;
    enrollRutIngresado = null;
    pendingEnrollConfirm = null;
    const form = document.getElementById('enroll-form');
    if (form) form.reset();
    const rutError = document.getElementById('enroll-rut-error');
    if (rutError) rutError.style.display = 'none';
    activarSensor();
}

async function iniciarRegistro() {
    if (activeWs) { activeWs.onclose = null; activeWs.close(); activeWs = null; }

    mostrarEnrollStep('enroll-step-scanning');

    const ws = new WebSocket(`${WS_URL}/ws/huella/capturar-identificar`);
    enrollWs = ws;
    let responded = false;

    ws.onmessage = async (event) => {
        responded = true;
        enrollWs = null;
        const data = JSON.parse(event.data);

        if (data.huella_hex) capturedHuellaHex = data.huella_hex;

        const userId = data.user_id;

        if (userId && userId > 0) {
            enrollCurrentUserId = userId;
            try {
                const usersRes = await fetch(`${API_URL}/api/usuarios`);
                const users = await usersRes.json();
                const user = users.find(u => u.id === userId);
                document.getElementById('enroll-nombre-encontrado').textContent = user?.nombre || `Usuario #${userId}`;
            } catch {}
            mostrarEnrollStep('enroll-step-ya-registrado');
        } else {
            mostrarFormularioRegistro();
        }
    };

    ws.onerror = () => { if (!responded) { enrollWs = null; cancelarRegistro(); } };
    ws.onclose = () => { if (!responded) { enrollWs = null; cancelarRegistro(); } };
}

async function iniciarReEnrolamiento() {
    if (!enrollCurrentUserId) return;
    document.getElementById('enroll-dedo-msg').textContent = 'Capturando nueva huella...';
    mostrarEnrollStep('enroll-step-dedo');

    const ws = new WebSocket(`${WS_URL}/ws/huella/editar/${enrollCurrentUserId}`);
    enrollWs = ws;
    let responded = false;

    ws.onmessage = (event) => {
        responded = true;
        enrollWs = null;
        const data = JSON.parse(event.data);
        if (data.estado) {
            document.getElementById('enroll-success-msg').textContent = 'Tu huella ha sido actualizada correctamente.';
            mostrarEnrollStep('enroll-step-success');
            setTimeout(() => cancelarRegistro(), 4000);
        } else {
            cancelarRegistro();
        }
    };

    ws.onerror = () => { if (!responded) { enrollWs = null; cancelarRegistro(); } };
    ws.onclose = () => { if (!responded) { enrollWs = null; cancelarRegistro(); } };
}

async function mostrarFormularioRegistro() {
    const select = document.getElementById('enroll-curso');
    select.innerHTML = '<option value="">Seleccione un curso</option>';
    try {
        const res = await fetch(`${API_URL}/api/cursos`);
        enrollCursosData = await res.json();
        select.innerHTML += enrollCursosData.map(c =>
            `<option value="${c.id}">${c.nombre}</option>`
        ).join('');
    } catch (e) {
        console.error('[REGISTRO] Error cargando cursos:', e.message);
    }
    mostrarEnrollStep('enroll-step-form');
}

async function handleEnrollForm(event) {
    event.preventDefault();

    const nombre = document.getElementById('enroll-nombre').value.trim();
    const cursoId = parseInt(document.getElementById('enroll-curso').value);
    if (!nombre || !cursoId) return;

    // Leer RUT opcional y validar si fue ingresado
    const rutRaw = document.getElementById('enroll-rut').value.trim();
    enrollRutIngresado = rutRaw || null;
    const rutErrorEl = document.getElementById('enroll-rut-error');
    if (enrollRutIngresado && !validarRut(enrollRutIngresado)) {
        rutErrorEl.style.display = 'block';
        return;
    }
    rutErrorEl.style.display = 'none';

    const cursoData = enrollCursosData.find(c => c.id === cursoId);
    const cursoNombre = cursoData ? cursoData.nombre : '';

    try {
        const params = new URLSearchParams({ nombre });
        const res = await fetch(`${API_URL}/api/usuarios/buscar?${params}`);
        if (!res.ok) { cancelarRegistro(); return; }

        let candidatos = await res.json();

        // Filtrar por curso seleccionado
        if (cursoNombre) {
            candidatos = candidatos.filter(u => u.curso === cursoNombre);
        }

        if (candidatos.length === 0) {
            // Alumno no existe → crear. El backend genera RUT provisional si no se envía uno.
            const crearRes = await fetch(`${API_URL}/api/usuarios/base`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre,
                    rut: enrollRutIngresado,
                    curso_id: cursoId,
                    estado_id: 1,
                    es_pae: true
                })
            });
            if (crearRes.status === 409) {
                const err = await crearRes.json();
                document.getElementById('enroll-rut-conflict-msg').textContent = err.detail || 'Este RUT ya pertenece a otro estudiante.';
                mostrarEnrollStep('enroll-step-rut-conflict');
                return;
            }
            if (!crearRes.ok) { cancelarRegistro(); return; }
            const { id: nuevoId } = await crearRes.json();
            enrollCurrentUserId = nuevoId;
            _procederEnrolamiento(nuevoId, nombre);
            return;
        }

        // Separar: sin huella vs con huella
        const sinHuella = candidatos.filter(u => !u.tiene_huella);
        const conHuella = candidatos.filter(u => u.tiene_huella);

        if (sinHuella.length === 0 && conHuella.length > 0) {
            // Todos los candidatos ya tienen huella → bloquear
            mostrarEnrollStep('enroll-step-ya-tiene-huella');
            return;
        }

        // Mostrar solo candidatos sin huella para confirmar
        mostrarConfirmacion(sinHuella);

    } catch (e) {
        console.error('[REGISTRO] Error buscando alumno:', e.message);
        cancelarRegistro();
    }
}

function mostrarConfirmacion(candidatos) {
    const contenedor = document.getElementById('enroll-candidatos');
    contenedor.innerHTML = candidatos.map(u => `
        <button class="enroll-btn enroll-btn-primary enroll-candidato"
                onclick="confirmarYEnrolar(${u.id}, '${u.nombre.replace(/'/g, "\\'")}', ${u.rut ? `'${u.rut}'` : 'null'})">
            ${u.nombre} — ${u.curso}
        </button>
    `).join('');
    mostrarEnrollStep('enroll-step-confirmar');
}

async function actualizarRutUsuario(userId, rut) {
    try {
        await fetch(`${API_URL}/api/usuarios/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rut })
        });
    } catch (e) {
        console.error('[REGISTRO] Error actualizando RUT:', e);
    }
}

async function confirmarYEnrolar(userId, nombre, existingRut = null) {
    enrollCurrentUserId = userId;

    // --- Lógica de RUT ---
    if (enrollRutIngresado) {
        if (existingRut && enrollRutIngresado !== existingRut) {
            // RUT ingresado difiere del que hay en BD → advertir
            pendingEnrollConfirm = { userId, nombre };
            document.getElementById('enroll-rut-old').textContent = `RUT actual: ${existingRut}`;
            document.getElementById('enroll-rut-new').textContent = `RUT ingresado: ${enrollRutIngresado}`;
            mostrarEnrollStep('enroll-step-rut-warning');
            return;
        }
        if (!existingRut) {
            // Estudiante sin RUT en BD → asignar el ingresado
            await actualizarRutUsuario(userId, enrollRutIngresado);
        }
        // Si RUT ingresado === RUT en BD, no hacer nada
    } else if (!existingRut) {
        // Sin RUT ingresado y sin RUT en BD → asignar provisional
        await actualizarRutUsuario(userId, generarRutAleatorio());
    }

    _procederEnrolamiento(userId, nombre);
}

async function confirmarSobrescribirRut() {
    if (!pendingEnrollConfirm) return;
    const { userId, nombre } = pendingEnrollConfirm;
    pendingEnrollConfirm = null;
    await actualizarRutUsuario(userId, enrollRutIngresado);
    _procederEnrolamiento(userId, nombre);
}

async function _procederEnrolamiento(userId, nombre) {
    mostrarEnrollStep('enroll-step-dedo');

    // Flujo 1: tenemos la huella del primer scan → vincular sin segundo scan
    if (capturedHuellaHex) {
        document.getElementById('enroll-dedo-msg').textContent = 'Vinculando huella...';
        try {
            const res = await fetch(`${API_URL}/api/huella/vincular`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: userId, huella_hex: capturedHuellaHex })
            });
            const data = await res.json();
            if (data.estado) {
                document.getElementById('enroll-success-msg').textContent =
                    `¡Bienvenido, ${nombre}! Tu huella ha sido registrada.`;
                capturedHuellaHex = null;
                mostrarEnrollStep('enroll-step-success');
                setTimeout(() => cancelarRegistro(), 5000);
                return;
            }
        } catch (e) {
            console.error('[REGISTRO] Error al vincular huella:', e);
        }
        capturedHuellaHex = null;
    }

    // Flujo 2 (fallback): segundo scan de huella
    document.getElementById('enroll-dedo-msg').textContent = 'Coloca tu dedo para registrar tu huella...';

    const ws = new WebSocket(`${WS_URL}/ws/huella/enrolar/${userId}`);
    enrollWs = ws;
    let responded = false;

    ws.onmessage = (event) => {
        responded = true;
        enrollWs = null;
        const data = JSON.parse(event.data);
        if (data.estado) {
            document.getElementById('enroll-success-msg').textContent =
                `¡Bienvenido, ${nombre}! Tu huella ha sido registrada.`;
            mostrarEnrollStep('enroll-step-success');
            setTimeout(() => cancelarRegistro(), 5000);
        } else {
            cancelarRegistro();
        }
    };

    ws.onerror = () => { if (!responded) { enrollWs = null; cancelarRegistro(); } };
    ws.onclose = () => { if (!responded) { enrollWs = null; cancelarRegistro(); } };
}