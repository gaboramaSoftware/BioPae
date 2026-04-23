// ============================================
// CONFIGURACIÓN MULTI-TÓTEM
// ============================================

// URL del tótem que sirve este panel (escritura/hardware siempre aquí)
const API_URL = window.location.origin;

function obtenerTotems() {
    try {
        const guardados = localStorage.getItem('biopae_totems');
        if (guardados) {
            const parsed = JSON.parse(guardados);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {}
    return [{ nombre: 'Tótem 1', url: window.location.origin }];
}

function guardarConfigTotems(lista) {
    localStorage.setItem('biopae_totems', JSON.stringify(lista));
    refreshData();
}

async function fetchDesdeTotems(path) {
    const totems = obtenerTotems();
    const promesas = totems.map(t => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        return fetch(`${t.url}${path}`, { signal: ctrl.signal })
            .then(r => { clearTimeout(timer); return r.json(); })
            .then(data => ({ data, totem: t }))
            .catch(() => null);
    });
    const resultados = await Promise.all(promesas);
    return resultados.filter(Boolean);
}

let estudiantesCache = [];
let currentStudent = null;
let enrollPollingInterval = null;
let enrollingUserId = null;   // ID del usuario creado pero aún sin huella confirmada
let enrollWs = null;          // WebSocket activo de enrolamiento
let confirmandoDuplicado = false;  // true cuando esperamos confirmación de duplicado
let usuarioDuplicadoId = null;     // ID del duplicado encontrado




// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    actualizarFecha();
    cargarDashboard();
    cargarEstudiantes();
    cargarRegistros();
    initCourseFilter();
});

function actualizarFecha() {
    const el = document.getElementById('current-date');
    if (el) el.textContent = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.querySelector(`[onclick="showSection('${id}')"]`)?.classList.add('active');
    const titulos = { dashboard: 'Dashboard', students: 'Estudiantes', reports: 'Informes', asistencia: 'Asistencia JUNAEB' };
    document.getElementById('page-title').textContent = titulos[id] || id;
    if (id === 'students') initCourseFilter();
    if (id === 'reports') cargarRegistros();
    if (id === 'asistencia') renderGrillaAsistencia();
}

function refreshData() {
    cargarDashboard();
    cargarEstudiantes();
    cargarRegistros();
    cargarRaciones();
}

// ============================================
// DASHBOARD
// ============================================

async function cargarDashboard() {
    cargarRaciones();
    try {
        const resultados = await fetchDesdeTotems('/api/registros/hoy');
        let desayunos = 0, almuerzos = 0, totemActivos = 0;
        resultados.forEach(({ data }) => {
            desayunos += data.desayunos ?? 0;
            almuerzos += data.almuerzos ?? 0;
            totemActivos++;
        });
        document.getElementById('count-breakfast').textContent = desayunos;
        document.getElementById('count-lunch').textContent = almuerzos;
        document.getElementById('count-total').textContent = desayunos + almuerzos;
        const terminalEl = document.getElementById('count-terminales');
        if (terminalEl) terminalEl.textContent = `${totemActivos}/${obtenerTotems().length}`;
    } catch (e) {
        console.error('[DASHBOARD] Error al cargar stats:', e.message);
    }
}

// ============================================
// RACIONES JUNAEB
// ============================================

async function cargarRaciones() {
    try {
        const res = await fetch(`${API_URL}/api/raciones`);
        if (!res.ok) return;
        const datos = await res.json();
        datos.forEach(({ tipo, total, usadas }) => {
            const inputEl    = document.getElementById(`input-total-${tipo}`);
            const contEl     = document.getElementById(`contador-${tipo}`);
            const barraEl    = document.getElementById(`barra-${tipo}`);
            if (!inputEl) return;

            inputEl.value = total > 0 ? total : '';

            if (total > 0) {
                const pct = Math.min(100, Math.round((usadas / total) * 100));
                contEl.textContent = `${usadas} usadas / ${total} totales (${100 - pct}% disponible)`;
                barraEl.style.width = `${pct}%`;
                barraEl.classList.toggle('llena', pct >= 100);
            } else {
                contEl.textContent = `${usadas} usadas · sin límite configurado`;
                barraEl.style.width = '0%';
                barraEl.classList.remove('llena');
            }
        });
    } catch (e) {
        console.error('[RACIONES] Error al cargar:', e.message);
    }
}

async function guardarRacion(tipo) {
    const inputEl = document.getElementById(`input-total-${tipo}`);
    const btn = inputEl.closest('.racion-edit').querySelector('.btn-guardar-racion');
    const total = parseInt(inputEl.value) || 0;
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    try {
        const res = await fetch(`${API_URL}/api/raciones/${tipo}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ total })
        });
        if (!res.ok) throw new Error('Error al guardar');
        await cargarRaciones();
        btn.textContent = 'Guardado';
        setTimeout(() => { btn.disabled = false; btn.textContent = 'Guardar'; }, 1500);
    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Guardar';
        alert('No se pudo guardar.');
    }
}

//=============================================
// FUNCIONES DE UTILIDAD
//=============================================

function generarRutAleatorio(){
    const base = Math.floor(Math.random() * 100000000) + 200000000;
    let suma = 0;
    let multiplicador = 2;
    let numeroTemp = base;

    while (numeroTemp > 0){
        suma += (numeroTemp % 10) * multiplicador;
        numeroTemp = Math.floor(numeroTemp / 10);
        multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto = suma % 11;
    const dvCalculado = 11 - resto;

    let dv = dvCalculado.toString();
    if(dvCalculado === 11) dv = '0';
    if(dvCalculado === 10) dv = 'K';

    return `${base}-${dv}`;
}

function validarRut(rutCompleto) {
    // 1. Limpiar el RUT (quitar puntos y guion)
    rutCompleto = rutCompleto.replace(/[.-]/g, '');
    if (rutCompleto.length < 2) return false;

    // 2. Separar cuerpo y DV
    let cuerpo = rutCompleto.slice(0, -1);
    let dv = rutCompleto.slice(-1).toLowerCase();

    // 3. Algoritmo Módulo 11
    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo.charAt(i)) * multiplo;
        multiplo = (multiplo < 7) ? multiplo + 1 : 2;
    }

    let dvEsperado = 11 - (suma % 11);
    
    // 4. Ajustar DV especial (11 -> 0, 10 -> K)
    dvEsperado = (dvEsperado === 11) ? '0' : (dvEsperado === 10) ? 'k' : dvEsperado.toString();

    // 5. Comparar
    return dvEsperado === dv;
}

// ============================================
// ESTUDIANTES
// ============================================

async function cargarEstudiantes() {
    try {
        const resultados = await fetchDesdeTotems('/api/usuarios');
        const porRut = new Map();
        resultados.forEach(({ data, totem }) => {
            data.forEach(u => {
                const clave = (u.rut || '').trim().toLowerCase() || `_noRut_${totem.url}_${u.id}`;
                const uid = `${totem.url}|${u.id}`;
                const enriquecido = { ...u, _uid: uid, _totem_url: totem.url, _totem_nombre: totem.nombre };
                if (!porRut.has(clave) || totem.url === API_URL) {
                    porRut.set(clave, enriquecido);
                }
            });
        });
        estudiantesCache = [...porRut.values()];
        renderTablaEstudiantes(_ordenarLista(estudiantesCache, sortEstudiantes.campo, sortEstudiantes.dir));
        _actualizarIconosSort('est-', ['nombre', 'curso'], sortEstudiantes.campo, sortEstudiantes.dir);
    } catch (e) {
        console.error('[ESTUDIANTES] Error al cargar:', e.message);
        document.getElementById('students-body').innerHTML = '<tr><td colspan="5" class="text-center">Error al cargar datos</td></tr>';
    }
}

function renderTablaEstudiantes(lista) {
    const tbody = document.getElementById('students-body');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay estudiantes registrados</td></tr>';
        return;
    }

    const multiTotem = obtenerTotems().length > 1;
    tbody.innerHTML = lista.map(u => `
        <tr>
            <td>${u.rut || 'Sin RUT'}</td>
            <td>${u.nombre}${multiTotem ? ` <span class="badge-totem" title="${u._totem_nombre}">${u._totem_nombre}</span>` : ''}</td>
            <td>${u.curso}</td>
            <td>${u.es_pae ? '<span class="badge-pae">PAE</span>' : '<span class="badge-no-pae">No PAE</span>'}</td>
            <td>
                <button class="btn-action btn-stats" onclick="openStudentStats('${u._uid}')">Ver</button>
            </td>
        </tr>
    `).join('');
}

function filterStudentsTable() {
    _renderEstudiantesActual();
}

async function initCourseFilter() {
    try {
        const res = await fetch(`${API_URL}/api/cursos`);
        const cursos = await res.json();
        // Excluir registros corruptos (nivel="°") y cursos sin letra
        const conLetra = cursos.filter(c => c.letra && c.letra.trim() !== '' && c.nivel !== '°');

        // El nivel completo combina numero + nivel: "1 Basico", "Pre-Kinder", etc.
        const nivelesSet = new Set(conLetra.map(c => c.numero ? `${c.numero} ${c.nivel}` : c.nivel));
        const niveles = [...nivelesSet].sort((a, b) => {
            const na = parseInt(a) || 0, nb = parseInt(b) || 0;
            if (na !== nb) return na - nb;
            return a.localeCompare(b);
        });
        const letras = [...new Set(conLetra.map(c => c.letra.trim()))].sort();

        const nivelSelect = document.getElementById('nivel-filter');
        nivelSelect.innerHTML = '<option value="">Todos los niveles</option>' +
            niveles.map(n => `<option value="${n}">${n}</option>`).join('');

        const letraSelect = document.getElementById('letra-filter');
        letraSelect.innerHTML = '<option value="">Todos los cursos</option>' +
            letras.map(l => `<option value="${l}">${l}</option>`).join('');
    } catch (e) {
        console.error('[FILTRO] Error al cargar cursos:', e.message);
    }
}

function filterStudentsByCourse() {
    _renderEstudiantesActual();
}

// ============================================
// MODAL ENROLAR
// ============================================

async function openEnrollModal() {
    // Resetear estado de duplicado
    confirmandoDuplicado = false;
    usuarioDuplicadoId = null;
    const notice = document.getElementById('enroll-duplicado-notice');
    if (notice) notice.style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/api/cursos`);
        const cursos = await res.json();
        const select = document.getElementById('enroll-curso');
        select.innerHTML = '<option value="">Seleccione un curso</option>' +
            cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } catch (e) {
        console.error('[ENROLAR] Error al cargar cursos:', e.message);
    }
    document.getElementById('enrollModal').classList.add('active');
}

function closeEnrollModal() {
    // Abortar WS si hay enrolamiento en curso
    if (enrollWs) {
        enrollWs.onclose = null;
        enrollWs.close();
        enrollWs = null;
    }
    if (enrollPollingInterval) {
        clearInterval(enrollPollingInterval);
        enrollPollingInterval = null;
    }
    // Eliminar usuario creado si la huella nunca se confirmó
    if (enrollingUserId) {
        fetch(`${API_URL}/api/usuarios/${enrollingUserId}`, { method: 'DELETE' }).catch(() => {});
        enrollingUserId = null;
    }
    // Resetear estado de duplicado
    confirmandoDuplicado = false;
    usuarioDuplicadoId = null;
    const notice = document.getElementById('enroll-duplicado-notice');
    if (notice) notice.style.display = 'none';

    document.getElementById('enrollModal').classList.remove('active');
    document.getElementById('enrollForm').reset();
    const submitBtn = document.getElementById('enrollForm')?.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.textContent = 'Enrolar Estudiante'; submitBtn.disabled = false; }
}

async function handleEnrollStudent(event) {
    event.preventDefault();

    const nombre   = document.getElementById('enroll-nombre').value.trim();
    const apellido = document.getElementById('enroll-apellido').value.trim();
    const cursoId  = parseInt(document.getElementById('enroll-curso').value);
    const esPae    = document.getElementById('enroll-pae')?.checked ?? false;
    const inputRut = document.getElementById('enroll-run')?.value.trim() ?? '';

    if (!nombre || !apellido || !cursoId) {
        alert('Completa nombre, apellido y curso.');
        return;
    }

    // Validar RUT si se ingresó
    if (inputRut !== '' && !validarRut(inputRut)) {
        alert('El RUT ingresado no es válido. Corrígelo o déjalo en blanco para generarlo automáticamente.');
        return;
    }

    const submitBtn = event.target.querySelector('[type="submit"]');

    // ─── Paso de confirmación de duplicado ───────────────────────────────────
    // El admin ya vio el aviso y (opcionalmente) corrigió el RUT. Procedemos.
    if (confirmandoDuplicado && usuarioDuplicadoId !== null) {
        submitBtn.textContent = 'Ponga el dedo en el sensor...';
        submitBtn.disabled = true;

        // Si el admin ingresó un RUT (nuevo o corregido), actualizar en BD
        if (inputRut !== '') {
            try {
                await fetch(`${API_URL}/api/usuarios/${usuarioDuplicadoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rut: inputRut })
                });
            } catch (e) {
                console.warn('[ENROLAR] No se pudo actualizar el RUT:', e.message);
            }
        }

        const wsBase = API_URL.replace(/^http/, 'ws');
        _iniciarCapturaHuella(
            `${wsBase}/ws/huella/editar/${usuarioDuplicadoId}`,
            nombre, apellido, submitBtn, true
        );
        return;
    }

    // ─── Flujo normal (primera vez) ──────────────────────────────────────────
    // RUT: usar el ingresado si es válido, o generar uno provisional
    const rutFinal = inputRut !== '' ? inputRut : generarRutAleatorio();

    submitBtn.textContent = 'Creando usuario...';
    submitBtn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/api/usuarios/base`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: `${nombre} ${apellido}`,
                rut: rutFinal,
                curso_id: cursoId,
                estado_id: 1,
                es_pae: esPae
            })
        });

        if (!res.ok) {
            const err = await res.json();
            alert('Error: ' + (err.detail || 'No se pudo crear el usuario'));
            submitBtn.textContent = 'Enrolar Estudiante';
            submitBtn.disabled = false;
            return;
        }

        const resData = await res.json();
        const usuarioId = resData.id;

        if (resData.duplicado) {
            // Mostrar aviso y pre-llenar el RUT actual para que el admin pueda corregirlo
            confirmandoDuplicado = true;
            usuarioDuplicadoId = usuarioId;

            const runInput = document.getElementById('enroll-run');
            if (runInput && resData.rut) runInput.value = resData.rut;

            const notice = document.getElementById('enroll-duplicado-notice');
            if (notice) notice.style.display = 'block';

            submitBtn.textContent = resData.tiene_huella
                ? 'Confirmar y sobrescribir huella'
                : 'Confirmar y asignar huella';
            submitBtn.disabled = false;
            return;
        }

        // Usuario nuevo → marcar para eliminación si se cierra sin confirmar
        enrollingUserId = usuarioId;
        submitBtn.textContent = 'Ponga el dedo en el sensor...';
        const wsBase = API_URL.replace(/^http/, 'ws');
        _iniciarCapturaHuella(
            `${wsBase}/ws/huella/enrolar/${usuarioId}`,
            nombre, apellido, submitBtn, false
        );

    } catch (e) {
        console.error('[ENROLAR] Error:', e.message);
        alert('Error de conexión al enrolar');
        submitBtn.textContent = 'Enrolar Estudiante';
        submitBtn.disabled = false;
    }
}

function _iniciarCapturaHuella(wsEndpoint, nombre, apellido, submitBtn, esDuplicado) {
    const ws = new WebSocket(wsEndpoint);
    enrollWs = ws;
    let responded = false;

    ws.onmessage = (ev) => {
        responded = true;
        enrollWs = null;
        const data = JSON.parse(ev.data);

        if (data.estado) {
            enrollingUserId = null;
            const msg = esDuplicado
                ? `✓ Huella de ${nombre} ${apellido} actualizada exitosamente.`
                : `✓ Estudiante ${nombre} ${apellido} enrolado exitosamente.`;
            alert(msg);
            closeEnrollModal();
            cargarEstudiantes();
        } else {
            alert('Error al capturar la huella: ' + (data.mensaje || 'Intente nuevamente.'));
            submitBtn.textContent = esDuplicado ? 'Confirmar y sobrescribir huella' : 'Enrolar Estudiante';
            submitBtn.disabled = false;
        }
    };

    ws.onerror = () => {
        if (!responded) {
            enrollWs = null;
            alert('Error de conexión con el sensor.');
            submitBtn.textContent = esDuplicado ? 'Confirmar y sobrescribir huella' : 'Enrolar Estudiante';
            submitBtn.disabled = false;
        }
    };

    ws.onclose = () => {
        if (!responded) {
            enrollWs = null;
            submitBtn.textContent = esDuplicado ? 'Confirmar y sobrescribir huella' : 'Enrolar Estudiante';
            submitBtn.disabled = false;
        }
    };
}

// ============================================
// MODAL ESTADÍSTICAS
// ============================================

async function openStudentStats(uid) {
    currentStudent = estudiantesCache.find(u => u._uid === uid);
    if (!currentStudent) return;

    document.getElementById('stats-avatar-letter').textContent = currentStudent.nombre[0].toUpperCase();
    document.getElementById('stats-student-name').textContent = currentStudent.nombre;
    document.getElementById('stats-student-run').textContent = 'RUN: ' + (currentStudent.rut || 'Sin RUT');
    document.getElementById('stats-student-curso').textContent = 'Curso: ' + currentStudent.curso;
    document.getElementById('stats-student-pae').textContent = 'PAE: ' + (currentStudent.es_pae ? 'Sí' : 'No');

    // Observaciones
    const obsEl = document.getElementById('stats-observaciones');
    const counterEl = document.getElementById('stats-obs-counter');
    obsEl.value = currentStudent.observaciones || '';
    counterEl.textContent = `${obsEl.value.length} / 1000`;
    obsEl.oninput = () => { counterEl.textContent = `${obsEl.value.length} / 1000`; };

    // Cargar historial para calcular stats
    try {
        const res = await fetch(`${currentStudent._totem_url}/api/usuarios/${currentStudent.id}/historial`);
        const historial = await res.json();
        const desayunos = historial.filter(h => h.tipo === 'desayuno').length;
        const almuerzos = historial.filter(h => h.tipo === 'almuerzo').length;
        document.getElementById('stats-breakfast').textContent = desayunos;
        document.getElementById('stats-lunch').textContent = almuerzos;
        document.getElementById('stats-total').textContent = desayunos + almuerzos;
        document.getElementById('stats-percentage').textContent = '-';
    } catch (e) {
        console.error('[STATS] Error:', e.message);
    }

    document.getElementById('statsModal').classList.add('active');
}

function closeStatsModal() {
    document.getElementById('statsModal').classList.remove('active');
}

async function guardarObservaciones() {
    if (!currentStudent) return;
    const texto = document.getElementById('stats-observaciones').value.slice(0, 1000);
    const btn = document.querySelector('.btn-guardar-obs');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    try {
        const res = await fetch(`${currentStudent._totem_url}/api/usuarios/${currentStudent.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ observaciones: texto })
        });
        if (!res.ok) throw new Error('Error al guardar');
        currentStudent.observaciones = texto;
        const idx = estudiantesCache.findIndex(u => u._uid === currentStudent._uid);
        if (idx !== -1) estudiantesCache[idx].observaciones = texto;
        btn.textContent = 'Guardado';
        setTimeout(() => { btn.disabled = false; btn.textContent = 'Guardar'; }, 1500);
    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Guardar';
        alert('No se pudo guardar la observación.');
    }
}

// ============================================
// MODAL DETALLE
// ============================================

async function openDetalleModal() {
    if (!currentStudent) return;
    closeStatsModal();

    document.getElementById('detalle-student-name').textContent = currentStudent.nombre;
    document.getElementById('detalle-student-run').textContent = 'RUN: ' + (currentStudent.rut || 'Sin RUT');

    try {
        const res = await fetch(`${currentStudent._totem_url}/api/usuarios/${currentStudent.id}/historial`);
        const historial = await res.json();
        const tbody = document.getElementById('detalle-body');
        tbody.innerHTML = historial.length === 0
            ? '<tr><td colspan="4" class="text-center">Sin registros</td></tr>'
            : historial.map(h => `
                <tr>
                    <td>${h.fecha}</td>
                    <td>${h.hora}</td>
                    <td>${h.tipo}</td>
                    <td>Emitido</td>
                </tr>`).join('');
    } catch (e) {
        console.error('[DETALLE] Error:', e.message);
    }

    document.getElementById('detalleModal').classList.add('active');
}

function closeDetalleModal() {
    document.getElementById('detalleModal').classList.remove('active');
}

// ============================================
// MODAL EDITAR
// ============================================

async function openEditModal() {
    if (!currentStudent) return;
    closeStatsModal();
    document.getElementById('edit-run').value = currentStudent.rut || '';
    document.getElementById('edit-nombre').value = currentStudent.nombre.split(' ')[0] || '';
    document.getElementById('edit-apellido').value = currentStudent.nombre.split(' ').slice(1).join(' ') || '';
    document.getElementById('edit-pae').checked = currentStudent.es_pae ?? false;

    // Cargar cursos en el select y preseleccionar el actual
    try {
        const res = await fetch(`${API_URL}/api/cursos`);
        const cursos = await res.json();
        const select = document.getElementById('edit-curso');
        select.innerHTML = '<option value="">Sin cambiar</option>' +
            cursos.map(c => `<option value="${c.id}"${c.id === currentStudent.curso_id ? ' selected' : ''}>${c.nombre}</option>`).join('');
    } catch (e) {
        console.error('[EDITAR] Error al cargar cursos:', e.message);
    }

    document.getElementById('editarModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editarModal').classList.remove('active');
}

async function handleEditStudent(event) {
    event.preventDefault();
    if (!currentStudent) return;

    const nombre = document.getElementById('edit-nombre').value.trim();
    const apellido = document.getElementById('edit-apellido').value.trim();
    const esPae = document.getElementById('edit-pae')?.checked ?? false;
    const rut = document.getElementById('edit-run').value.trim();

    if (rut && !validarRut(rut)) {
        alert('El RUT ingresado no es válido.');
        return;
    }

    const cursoIdRaw = document.getElementById('edit-curso').value;
    const cursoId = cursoIdRaw ? parseInt(cursoIdRaw) : null;

    try {
        await fetch(`${currentStudent._totem_url}/api/usuarios/${currentStudent.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: `${nombre} ${apellido}`, es_pae: esPae, rut: rut || null, curso_id: cursoId })
        });
        closeEditModal();
        cargarEstudiantes();
    } catch (e) {
        alert('Error al guardar cambios');
    }
}

// ============================================
// MODAL ELIMINAR
// ============================================

function openDeleteModal() {
    if (!currentStudent) return;
    closeEditModal();
    document.getElementById('delete-student-name').textContent = currentStudent.nombre;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
}

async function handleDeleteStudent() {
    if (!currentStudent) return;
    try {
        const res = await fetch(`${currentStudent._totem_url}/api/usuarios/${currentStudent.id}`, { method: 'DELETE' });
        if (res.ok) {
            closeDeleteModal();
            currentStudent = null;
            cargarEstudiantes();
        } else {
            alert('Error al eliminar estudiante');
        }
    } catch (e) {
        alert('Error de conexión al eliminar');
    }
}

function openDeleteRegistrosModal() {
    document.getElementById('deleteRegistrosModal').classList.add('active');
}

function closeDeleteRegistrosModal() {
    document.getElementById('deleteRegistrosModal').classList.remove('active');
    const input = document.getElementById('confirm-borrar-registros');
    if (input) { input.value = ''; }
    const btn = document.getElementById('btn-confirmar-borrar-registros');
    if (btn) btn.disabled = true;
}

async function handleDeleteRegistros() {
    try {
        const res = await fetch(`${API_URL}/api/registros`, { method: 'DELETE' });
        if (res.ok) {
            closeDeleteRegistrosModal();
            cargarRegistros();
            cargarDashboard();
        } else {
            alert('Error al eliminar registros');
        }
    } catch (e) {
        alert('Error de conexión al eliminar');
    }
}

function openDeleteAllModal() {
    document.getElementById('deleteAllModal').classList.add('active');
}

function closeDeleteAllModal() {
    document.getElementById('deleteAllModal').classList.remove('active');
    const input = document.getElementById('confirm-borrar-alumnos');
    if (input) { input.value = ''; }
    const btn = document.getElementById('btn-confirmar-borrar-alumnos');
    if (btn) btn.disabled = true;
}

async function handleDeleteAll() {
    try {
        const res = await fetch(`${API_URL}/api/usuarios`, { method: 'DELETE' });
        if (res.ok) {
            closeDeleteAllModal();
            currentStudent = null;
            cargarEstudiantes();
            cargarDashboard();
        } else {
            alert('Error al eliminar estudiantes');
        }
    } catch (e) {
        alert('Error de conexión al eliminar');
    }
}

// ============================================
// TABLA REGISTROS (DASHBOARD Y INFORMES)
// ============================================

let registrosCache = [];

// Estado de ordenación persistente entre cargas
let sortEstudiantes = { campo: 'curso', dir: 1 };
let sortRegistros   = { campo: 'fecha', dir: -1 };  // LIFO: más reciente primero

// ============================================
// ORDENACIÓN: SISTEMA EDUCACIONAL CHILENO
// ============================================

function _ordenCursoChileno(cursoStr) {
    if (!cursoStr) return { nivelNum: 9999, letra: '' };
    const partes   = cursoStr.trim().split(/\s+/);
    const letra    = partes.length > 1 ? partes[partes.length - 1] : '';
    const sinLetra = partes.length > 1 ? partes.slice(0, -1).join(' ') : cursoStr;
    let nivelNum   = 9999;
    if      (sinLetra === 'Pre-Kinder') nivelNum = 0;
    else if (sinLetra === 'Kinder')     nivelNum = 1;
    else {
        const m = sinLetra.match(/^(\d+)\s+(.+)$/);
        if (m) {
            const num = parseInt(m[1]);
            if      (m[2] === 'Basico') nivelNum = 1 + num;  // 2..9
            else if (m[2] === 'Medio')  nivelNum = 9 + num;  // 10..13
        }
    }
    return { nivelNum, letra };
}

function _compararCurso(cursoA, cursoB) {
    const ka = _ordenCursoChileno(cursoA);
    const kb = _ordenCursoChileno(cursoB);
    if (ka.nivelNum !== kb.nivelNum) return ka.nivelNum - kb.nivelNum;
    return (ka.letra || '').localeCompare(kb.letra || '');
}

/** Ordena estudiantes o registros.
 *  Campos válidos: 'curso', 'nombre', 'fecha', 'hora'. */
function _ordenarLista(lista, campo, dir) {
    return [...lista].sort((a, b) => {
        const nA = ((a.nombre || a.estudiante) || '').toLowerCase();
        const nB = ((b.nombre || b.estudiante) || '').toLowerCase();
        const cA = a.curso  || '';
        const cB = b.curso  || '';
        const fA = a.fecha  || '';
        const fB = b.fecha  || '';
        const hA = a.hora   || '';
        const hB = b.hora   || '';

        if (campo === 'curso') {
            const cc = _compararCurso(cA, cB);
            if (cc !== 0) return cc * dir;
            return nA.localeCompare(nB);          // nombre A-Z dentro del mismo curso
        }
        if (campo === 'nombre') {
            const nc = nA.localeCompare(nB);
            if (nc !== 0) return nc * dir;
            return _compararCurso(cA, cB);        // curso chileno como desempate
        }
        if (campo === 'fecha') {
            if (fA !== fB) return fA.localeCompare(fB) * dir;
            return hA.localeCompare(hB) * dir;    // misma fecha → desempate por hora
        }
        if (campo === 'hora') {
            if (hA !== hB) return hA.localeCompare(hB) * dir;
            return fA.localeCompare(fB) * dir;    // misma hora → desempate por fecha
        }
        return 0;
    });
}

/** Resetea todos los íconos del grupo y activa el correcto.
 *  @param {string}   prefijo  'est-' | 'rep-'
 *  @param {string[]} campos   lista completa de campos del grupo
 *  @param {string}   campo    campo activo
 *  @param {number}   dir      1 = asc, -1 = desc
 */
function _actualizarIconosSort(prefijo, campos, campo, dir) {
    campos.forEach(c => {
        const el = document.getElementById(`sort-icon-${prefijo}${c}`);
        if (el) { el.textContent = '⇅'; el.classList.remove('active'); }
    });
    const activo = document.getElementById(`sort-icon-${prefijo}${campo}`);
    if (activo) { activo.textContent = dir === 1 ? '↑' : '↓'; activo.classList.add('active'); }
}

// Vista unificada de estudiantes (aplica búsqueda + filtro de curso + sort actual)
function _renderEstudiantesActual() {
    const q     = document.getElementById('search-students-input')?.value.toLowerCase() ?? '';
    const nivel = document.getElementById('nivel-filter')?.value ?? '';
    const letra = document.getElementById('letra-filter')?.value ?? '';

    if ((nivel && !letra) || (!nivel && letra)) {
        document.getElementById('students-body').innerHTML =
            '<tr><td colspan="5" class="text-center">Selecciona nivel y letra</td></tr>';
        return;
    }

    let base = estudiantesCache;
    if (q)            base = base.filter(u => u.nombre.toLowerCase().includes(q) || (u.rut && u.rut.toLowerCase().includes(q)));
    if (nivel && letra) base = base.filter(u => u.curso === `${nivel} ${letra}`);

    renderTablaEstudiantes(_ordenarLista(base, sortEstudiantes.campo, sortEstudiantes.dir));
    _actualizarIconosSort('est-', ['nombre', 'curso'], sortEstudiantes.campo, sortEstudiantes.dir);
}

function setSortEstudiantes(campo) {
    if (sortEstudiantes.campo === campo) sortEstudiantes.dir *= -1;
    else { sortEstudiantes.campo = campo; sortEstudiantes.dir = 1; }
    _renderEstudiantesActual();
}

// Vista unificada de registros (aplica búsqueda + sort actual)
function _renderRegistrosActual() {
    const q = document.getElementById('search-reports-input')?.value.toLowerCase() ?? '';
    let base = registrosCache;
    if (q) base = base.filter(r => r.estudiante.toLowerCase().includes(q));
    renderTablaRegistros(_ordenarLista(base, sortRegistros.campo, sortRegistros.dir), 'reports-body');
    _actualizarIconosSort('rep-', ['nombre', 'curso', 'fecha'], sortRegistros.campo, sortRegistros.dir);
}

function setSortRegistros(campo) {
    if (sortRegistros.campo === campo) {
        sortRegistros.dir *= -1;
    } else {
        sortRegistros.campo = campo;
        // fecha arranca en desc (LIFO: más reciente primero); nombre/curso en asc
        sortRegistros.dir = campo === 'fecha' ? -1 : 1;
    }
    _renderRegistrosActual();
}

async function cargarRegistros() {
    try {
        const resultados = await fetchDesdeTotems('/api/registros');
        const todos = [];
        resultados.forEach(({ data, totem }) => {
            data.forEach(r => todos.push({ ...r, _totem_nombre: totem.nombre }));
        });
        todos.sort((a, b) => {
            const fa = a.fecha || '', fb = b.fecha || '';
            if (fa !== fb) return fb.localeCompare(fa);
            return (b.hora || '').localeCompare(a.hora || '');
        });
        registrosCache = todos;
        renderTablaRegistros(_ordenarLista(registrosCache, sortRegistros.campo, sortRegistros.dir), 'reports-body');
        _actualizarIconosSort('rep-', ['nombre', 'curso', 'fecha'], sortRegistros.campo, sortRegistros.dir);
        if (typeof renderGraficoCursos === 'function') renderGraficoCursos(registrosCache);
    } catch (e) {
        console.error('[REGISTROS] Error al cargar:', e.message);
        const msg = '<tr><td colspan="5" class="text-center">Error al cargar registros</td></tr>';
        document.getElementById('reports-body').innerHTML = msg;
    }
}

function formatFecha(fechaStr) {
    if (!fechaStr) return '-';
    // Acepta "YYYY-MM-DD" o ISO completo; devuelve "dd/mm/yy"
    const [y, m, d] = fechaStr.split('T')[0].split('-');
    if (!y || !m || !d) return fechaStr;
    return `${d}/${m}/${y.slice(2)}`;
}

function renderTablaRegistros(lista, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay registros</td></tr>';
        return;
    }
    tbody.innerHTML = lista.map(r => `
        <tr>
            <td>${r.estudiante}</td>
            <td>${r.curso}</td>
            <td>${r.racion}</td>
            <td>${formatFecha(r.fecha)}</td>
            <td>${r.hora}</td>
        </tr>
    `).join('');
}


function filterReportsTable() {
    _renderRegistrosActual();
}

function openExportModal() {
    if (registrosCache.length === 0) {
        alert('No hay registros para exportar');
        return;
    }

    // Poblar checkboxes de cursos únicos desde el cache
    const cursosUnicos = [...new Set(registrosCache.map(r => r.curso).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const container = document.getElementById('export-cursos-checks');
    container.innerHTML = cursosUnicos.map(c => `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.83rem;">
            <input type="checkbox" class="export-registro-curso-check" value="${c}" checked>
            ${c}
        </label>
    `).join('');
    container.querySelectorAll('.export-registro-curso-check').forEach(cb =>
        cb.addEventListener('change', actualizarPreviewExport)
    );

    // Poblar raciones únicas desde el cache
    const raciones = [...new Set(registrosCache.map(r => r.racion).filter(Boolean))].sort();
    const selectRacion = document.getElementById('export-racion');
    selectRacion.innerHTML = '<option value="">Todas las raciones</option>' +
        raciones.map(r => `<option value="${r}">${r}</option>`).join('');

    // Resetear fechas y preview
    document.getElementById('export-fecha-desde').value = '';
    document.getElementById('export-fecha-hasta').value = '';
    actualizarPreviewExport();

    ['export-racion', 'export-fecha-desde', 'export-fecha-hasta'].forEach(id => {
        document.getElementById(id).onchange = actualizarPreviewExport;
    });

    document.getElementById('exportModal').classList.add('active');
}

function seleccionarTodosCursosExport(estado) {
    document.querySelectorAll('.export-registro-curso-check').forEach(cb => cb.checked = estado);
    actualizarPreviewExport();
}

function closeExportModal() {
    document.getElementById('exportModal').classList.remove('active');
}

function aplicarFiltrosExport() {
    const cursosChecked = Array.from(document.querySelectorAll('.export-registro-curso-check:checked')).map(cb => cb.value);
    const racion = document.getElementById('export-racion').value;
    const desde  = document.getElementById('export-fecha-desde').value;
    const hasta  = document.getElementById('export-fecha-hasta').value;

    return registrosCache.filter(r => {
        if (cursosChecked.length > 0 && !cursosChecked.includes(r.curso)) return false;
        if (racion && r.racion !== racion) return false;
        const fechaISO = r.fecha ? r.fecha.split('T')[0] : null;
        if (desde && fechaISO && fechaISO < desde) return false;
        if (hasta && fechaISO && fechaISO > hasta) return false;
        return true;
    });
}

function actualizarPreviewExport() {
    const total = aplicarFiltrosExport().length;
    document.getElementById('export-preview').textContent =
        total > 0 ? `${total} registro${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}` : 'Sin resultados para los filtros seleccionados';
}

function confirmarExportacion() {
    const filtrados = aplicarFiltrosExport();
    if (filtrados.length === 0) {
        alert('No hay registros que coincidan con los filtros seleccionados.');
        return;
    }

    const cursosSeleccionados = Array.from(document.querySelectorAll('.export-registro-curso-check:checked')).map(cb => cb.value);
    const racion = document.getElementById('export-racion').value;
    const desde  = document.getElementById('export-fecha-desde').value;
    const hasta  = document.getElementById('export-fecha-hasta').value;
    const formato = document.querySelector('input[name="export-formato"]:checked')?.value ?? 'xlsx';

    const cursoArchivo  = cursosSeleccionados.length === 1 ? cursosSeleccionados[0].replace(/\s+/g, '_') : (cursosSeleccionados.length > 1 ? 'varios' : 'todos');
    const racionArchivo = racion || 'todas';
    const rango         = desde || hasta ? `_${desde || ''}a${hasta || ''}` : '';
    const fechaHoy      = new Date().toISOString().slice(0, 10);

    if (formato === 'xlsx') {
        // Exportación real .xlsx via backend con filtros como query params
        const params = new URLSearchParams();
        if (cursosSeleccionados.length === 1) params.set('curso', cursosSeleccionados[0]);
        if (racion) params.set('racion', racion);
        if (desde)  params.set('fecha_desde', desde);
        if (hasta)  params.set('fecha_hasta', hasta);

        const a = document.createElement('a');
        a.href = `${API_URL}/api/exportar/excel/filtrado?${params.toString()}`;
        a.download = `registros_${cursoArchivo}_${racionArchivo}${rango}_${fechaHoy}.xlsx`;
        a.click();
    } else {
        // CSV para Power BI (client-side, mantiene los datos ya cargados de todos los tótems)
        const filas = [['ID', 'Estudiante', 'Curso', 'Ración', 'Fecha', 'Hora', 'Terminal', 'Estado']];
        filtrados.forEach(r => filas.push([
            r.id, r.estudiante, r.curso, r.racion,
            formatFecha(r.fecha), r.hora, r.terminal, r.estado
        ]));
        const csv = filas.map(f => f.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registros_${cursoArchivo}_${racionArchivo}${rango}_${fechaHoy}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    closeExportModal();
}

// ============================================
// GRILLA DE ASISTENCIA
// ============================================

let asistenciaAnio = new Date().getFullYear();
let asistenciaMes  = new Date().getMonth() + 1; // 1-12
let asistenciaCurso = ''; // filtro de curso activo

function filtrarAsistenciaCurso() {
    asistenciaCurso = document.getElementById('asistencia-curso-filter').value;
    renderGrillaAsistencia();
}

function mesAnterior() {
    asistenciaMes--;
    if (asistenciaMes < 1) { asistenciaMes = 12; asistenciaAnio--; }
    renderGrillaAsistencia();
}

function mesSiguiente() {
    asistenciaMes++;
    if (asistenciaMes > 12) { asistenciaMes = 1; asistenciaAnio++; }
    renderGrillaAsistencia();
}

async function renderGrillaAsistencia() {
    const container = document.getElementById('asistencia-container');
    if (!container) return;

    // Si los caches aún no tienen datos, cargarlos primero
    if (!estudiantesCache.length || !registrosCache.length) {
        container.innerHTML = '<p class="text-center">Cargando datos...</p>';
        await Promise.all([cargarEstudiantes(), cargarRegistros()]);
    }

    const anioStr = String(asistenciaAnio);
    const mesStr  = String(asistenciaMes).padStart(2, '0');
    const diasEnMes = new Date(asistenciaAnio, asistenciaMes, 0).getDate();

    // Label del mes en el header
    const label = new Date(asistenciaAnio, asistenciaMes - 1, 1)
        .toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    document.getElementById('asistencia-mes-label').textContent =
        label.charAt(0).toUpperCase() + label.slice(1);

    // Set de asistencia: "nombre_YYYY-MM-DD"
    const asistioSet = new Set();
    registrosCache.forEach(r => {
        if (r.fecha && r.fecha.startsWith(`${anioStr}-${mesStr}`)) {
            asistioSet.add(`${r.estudiante}_${r.fecha.split('T')[0]}`);
        }
    });

    // Poblar select de cursos (preservar selección actual)
    const selectCurso = document.getElementById('asistencia-curso-filter');
    if (selectCurso) {
        const cursosUnicos = [...new Set(estudiantesCache.map(e => e.curso).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const valorActual = selectCurso.value;
        selectCurso.innerHTML = '<option value="">Todos los cursos</option>' +
            cursosUnicos.map(c => `<option value="${c}"${c === valorActual ? ' selected' : ''}>${c}</option>`).join('');
    }

    // Ordenar y filtrar por curso (orden educacional chileno)
    const sorted = [...estudiantesCache]
        .sort((a, b) => _compararCurso(a.curso, b.curso) || a.nombre.localeCompare(b.nombre))
        .filter(e => !asistenciaCurso || e.curso === asistenciaCurso);

    // Colores del tema oscuro
    const BG_CARD    = '#1e293b';
    const BG_HEADER  = 'rgba(0,0,0,0.25)';
    const BG_WEEKEND = '#162031';
    const BORDER_COL = 'rgba(255,255,255,0.13)';
    const COLOR_MUTED = '#94a3b8';
    const COLOR_WEEKEND = '#64748b';

    // Anchos de columnas fijas (eje Y)
    const COL_RUT    = 75;   // px
    const COL_NOMBRE = 150;  // px
    const COL_CURSO  = 65;   // px
    const LEFT_NOMBRE = COL_RUT;
    const LEFT_CURSO  = COL_RUT + COL_NOMBRE;

    // Cabecera de días
    const diasHeaders = Array.from({ length: diasEnMes }, (_, i) => {
        const d = i + 1;
        const dow = new Date(asistenciaAnio, asistenciaMes - 1, d).getDay();
        const esFinde = dow === 0 || dow === 6;
        return `<th style="min-width:24px;width:24px;text-align:center;font-size:0.6rem;padding:5px 1px;color:${esFinde ? COLOR_WEEKEND : COLOR_MUTED};background:${esFinde ? BG_WEEKEND : BG_HEADER};">${d}</th>`;
    }).join('');

    // Filas de alumnos
    const filas = sorted.map((u, rowIdx) => {
        const rowBg = rowIdx % 2 === 0 ? BG_CARD : 'rgba(255,255,255,0.02)';
        const celdas = Array.from({ length: diasEnMes }, (_, i) => {
            const d = String(i + 1).padStart(2, '0');
            const fechaKey = `${anioStr}-${mesStr}-${d}`;
            const dow = new Date(asistenciaAnio, asistenciaMes - 1, i + 1).getDay();
            const esFinde = dow === 0 || dow === 6;
            const asistio = asistioSet.has(`${u.nombre}_${fechaKey}`);
            return `<td style="text-align:center;padding:3px 1px;background:${esFinde ? BG_WEEKEND : 'transparent'};">
                ${asistio
                    ? '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:#3b82f6;box-shadow:0 0 5px rgba(59,130,246,0.4);" title="Asistió"></span>'
                    : '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);" title="No registrado"></span>'}
            </td>`;
        }).join('');

        return `<tr style="background:${rowBg};">
            <td style="max-width:${COL_RUT}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 8px;font-size:0.68rem;position:sticky;left:0;background:${rowBg};z-index:1;border-right:1px solid ${BORDER_COL};color:#94a3b8;">${u.rut || ''}</td>
            <td style="max-width:${COL_NOMBRE}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 8px;font-size:0.72rem;position:sticky;left:${LEFT_NOMBRE}px;background:${rowBg};z-index:1;border-right:1px solid ${BORDER_COL};font-weight:500;">${u.nombre}</td>
            <td style="max-width:${COL_CURSO}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 8px;font-size:0.68rem;position:sticky;left:${LEFT_CURSO}px;background:${rowBg};z-index:1;border-right:2px solid ${BORDER_COL};color:#94a3b8;">${u.curso}</td>
            ${celdas}
        </tr>`;
    }).join('');

    const colspan = 3 + diasEnMes;
    container.innerHTML = `
        <table class="data-table" style="min-width:max-content;border-collapse:collapse;font-size:0.72rem;">
            <thead>
                <tr>
                    <th style="max-width:${COL_RUT}px;white-space:nowrap;position:sticky;left:0;background:${BG_HEADER};z-index:2;border-right:1px solid ${BORDER_COL};">RUT</th>
                    <th style="max-width:${COL_NOMBRE}px;white-space:nowrap;position:sticky;left:${LEFT_NOMBRE}px;background:${BG_HEADER};z-index:2;border-right:1px solid ${BORDER_COL};">Nombre</th>
                    <th style="max-width:${COL_CURSO}px;white-space:nowrap;position:sticky;left:${LEFT_CURSO}px;background:${BG_HEADER};z-index:2;border-right:2px solid ${BORDER_COL};">Curso</th>
                    ${diasHeaders}
                </tr>
            </thead>
            <tbody>
                ${filas.length
                    ? filas
                    : `<tr><td colspan="${colspan}" class="text-center">${asistenciaCurso ? `Curso "${asistenciaCurso}" no registrado` : 'No hay estudiantes registrados'}</td></tr>`}
            </tbody>
        </table>
    `;
}

function exportarAsistenciaExcel() {
    const params = new URLSearchParams();
    params.set('anio', asistenciaAnio);
    params.set('mes', asistenciaMes);
    if (asistenciaCurso) params.set('curso', asistenciaCurso);

    const mesLabel = new Date(asistenciaAnio, asistenciaMes - 1, 1)
        .toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
        .replace(/ /g, '_');
    const a = document.createElement('a');
    a.href = `${API_URL}/api/exportar/asistencia?${params.toString()}`;
    a.download = `asistencia_junaeb_${mesLabel}.xlsx`;
    a.click();
}

// ============================================
// IMPORTAR LISTA JUNAEB
// ============================================

async function importarJUNAEB(input) {
    const file = input.files[0];
    if (!file) return;

    const statusEl = document.getElementById('import-status');
    statusEl.style.display = 'inline';
    statusEl.textContent = 'Importando...';
    statusEl.className = 'import-status importing';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_URL}/api/usuarios/importar`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.estado) {
            statusEl.textContent = `✓ ${data.mensaje}`;
            statusEl.className = 'import-status success';
            cargarEstudiantes();
        } else {
            statusEl.textContent = `✗ ${data.mensaje || data.detail}`;
            statusEl.className = 'import-status error';
        }
    } catch (e) {
        statusEl.textContent = '✗ Error de conexión';
        statusEl.className = 'import-status error';
    }

    input.value = '';
    setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
}

// ============================================
// EXPORTAR A EXCEL (esto hay que tambien transformarlo en una API)
// ============================================

// ============================================
// CONFIGURACIÓN DE TÓTEMS
// ============================================

function openSettingsModal() {
    renderListaTotems();
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

function openCredencialesModal() {
    // Limpiar estado anterior
    document.getElementById('cred-rut-actual').value = '';
    document.getElementById('cred-nuevo-rut').value = '';
    document.getElementById('cred-nueva-password').value = '';
    document.getElementById('cred-confirmar-password').value = '';
    const msg = document.getElementById('credenciales-msg');
    msg.style.display = 'none';
    msg.textContent = '';
    document.getElementById('credencialesModal').classList.add('active');
}

function closeCredencialesModal() {
    document.getElementById('credencialesModal').classList.remove('active');
}

async function renderListaTotems() {
    const totems = obtenerTotems();
    const container = document.getElementById('totems-lista');
    container.innerHTML = '<p style="color:#94a3b8;font-size:0.8rem;">Verificando conexión...</p>';

    const estados = await Promise.all(totems.map(async t => {
        try {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), 3000);
            const r = await fetch(`${t.url}/api/db/status`, { signal: ctrl.signal });
            const data = await r.json();
            return data.estado === true;
        } catch { return false; }
    }));

    container.innerHTML = totems.map((t, i) => `
        <div class="totem-item" id="totem-item-${i}">
            <div class="totem-status-dot ${estados[i] ? 'online' : 'offline'}"></div>
            <div class="totem-item-info" id="totem-info-${i}">
                <strong>${t.nombre}</strong>
                <span>${t.url}</span>
                <small style="color:${estados[i] ? '#22c55e' : '#ef4444'}">${estados[i] ? 'En línea' : 'Sin conexión'}</small>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="btn-sm btn-edit-totem" onclick="editarTotem(${i})">✏️</button>
                ${totems.length > 1 ? `<button class="btn-sm" onclick="eliminarTotem(${i})">✕</button>` : ''}
            </div>
        </div>
    `).join('');
}

function agregarTotem() {
    const nombre = document.getElementById('nuevo-totem-nombre').value.trim();
    const url = document.getElementById('nuevo-totem-url').value.trim().replace(/\/$/, '');
    if (!nombre || !url) { alert('Completa nombre y URL del tótem'); return; }
    try { new URL(url); } catch { alert('URL inválida. Ejemplo: http://192.168.1.11:8080'); return; }
    const totems = obtenerTotems();
    if (totems.some(t => t.url === url)) { alert('Ese tótem ya está configurado'); return; }
    totems.push({ nombre, url });
    guardarConfigTotems(totems);
    document.getElementById('nuevo-totem-nombre').value = '';
    document.getElementById('nuevo-totem-url').value = '';
    renderListaTotems();
}

function editarTotem(index) {
    const totems = obtenerTotems();
    const t = totems[index];
    const infoEl = document.getElementById(`totem-info-${index}`);
    const itemEl = document.getElementById(`totem-item-${index}`);
    if (!infoEl || !itemEl) return;

    // Reemplazar la info por inputs inline
    infoEl.innerHTML = `
        <input id="edit-totem-nombre-${index}" type="text" value="${t.nombre}"
            style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;color:#f1f5f9;font-size:0.85rem;width:100%;margin-bottom:4px;">
        <input id="edit-totem-url-${index}" type="text" value="${t.url}"
            style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;color:#f1f5f9;font-size:0.75rem;width:100%;">
    `;

    // Reemplazar botones por guardar/cancelar
    const botonesEl = infoEl.nextElementSibling;
    botonesEl.innerHTML = `
        <button class="btn-sm btn-edit-totem" onclick="guardarEdicionTotem(${index})">✓</button>
        <button class="btn-sm" style="background:rgba(255,255,255,0.06);color:#94a3b8;" onclick="renderListaTotems()">✕</button>
    `;
}

function guardarEdicionTotem(index) {
    const nombre = document.getElementById(`edit-totem-nombre-${index}`)?.value.trim();
    const url    = document.getElementById(`edit-totem-url-${index}`)?.value.trim().replace(/\/$/, '');

    if (!nombre || !url) { alert('Completa nombre y URL'); return; }
    try { new URL(url); } catch { alert('URL inválida. Ejemplo: http://192.168.1.11:8080'); return; }

    const totems = obtenerTotems();
    const duplicado = totems.findIndex((t, i) => t.url === url && i !== index);
    if (duplicado !== -1) { alert('Esa URL ya está en uso por otro tótem'); return; }

    totems[index] = { nombre, url };
    guardarConfigTotems(totems);
    renderListaTotems();
}

function eliminarTotem(index) {
    const totems = obtenerTotems();
    if (totems.length <= 1) { alert('Debe haber al menos un tótem configurado'); return; }
    totems.splice(index, 1);
    guardarConfigTotems(totems);
    renderListaTotems();
}

async function guardarCredenciales() {
    const rutActual        = document.getElementById('cred-rut-actual').value.trim();
    const nuevoRut         = document.getElementById('cred-nuevo-rut').value.trim();
    const nuevaPassword    = document.getElementById('cred-nueva-password').value;
    const confirmarPassword = document.getElementById('cred-confirmar-password').value;
    const msgEl = document.getElementById('credenciales-msg');

    const mostrarMsg = (texto, ok) => {
        msgEl.textContent = texto;
        msgEl.style.display = 'block';
        msgEl.style.background = ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
        msgEl.style.color = ok ? '#4ade80' : '#f87171';
        msgEl.style.border = `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`;
    };

    if (!rutActual || !nuevoRut || !nuevaPassword || !confirmarPassword) {
        return mostrarMsg('Todos los campos son obligatorios.', false);
    }
    if (nuevaPassword !== confirmarPassword) {
        return mostrarMsg('Las contraseñas nuevas no coinciden.', false);
    }
    if (nuevaPassword.length < 6) {
        return mostrarMsg('La nueva contraseña debe tener al menos 6 caracteres.', false);
    }

    try {
        const res = await fetch(`${API_URL}/api/auth/credenciales`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rut_actual: rutActual, nuevo_rut: nuevoRut, nueva_password: nuevaPassword })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            mostrarMsg('Credenciales actualizadas correctamente.', true);
            document.getElementById('cred-rut-actual').value = '';
            document.getElementById('cred-nuevo-rut').value = '';
            document.getElementById('cred-nueva-password').value = '';
            document.getElementById('cred-confirmar-password').value = '';
        } else {
            const errMsg = Array.isArray(data.detail)
                ? data.detail.map(e => e.msg || JSON.stringify(e)).join(' | ')
                : (data.detail || data.error || 'Error al actualizar credenciales.');
            mostrarMsg(errMsg, false);
        }
    } catch (e) {
        mostrarMsg('Error de conexión con el servidor.', false);
    }
}

function exportarListaJUNAEB() {
    openExportStudentsModal();
}

function openExportStudentsModal() {
    const container = document.getElementById('export-students-cursos');
    const cursosUnicos = [...new Set(estudiantesCache.map(u => u.curso).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    if (cursosUnicos.length === 0) {
        container.innerHTML = '<p style="color:#64748b;font-size:0.8rem;">No hay alumnos cargados.</p>';
    } else {
        container.innerHTML = cursosUnicos.map(c => `
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.83rem;">
                <input type="checkbox" class="export-students-curso-check" value="${c}" checked>
                ${c}
            </label>
        `).join('');
    }

    actualizarPreviewExportStudents();
    container.querySelectorAll('.export-students-curso-check').forEach(cb =>
        cb.addEventListener('change', actualizarPreviewExportStudents)
    );
    document.getElementById('exportStudentsModal').classList.add('active');
}

function closeExportStudentsModal() {
    document.getElementById('exportStudentsModal').classList.remove('active');
}

function seleccionarTodosCursos(estado) {
    document.querySelectorAll('.export-students-curso-check').forEach(cb => cb.checked = estado);
    actualizarPreviewExportStudents();
}

function actualizarPreviewExportStudents() {
    const seleccionados = cursosSeleccionados();
    const total = estudiantesCache.filter(u => seleccionados.includes(u.curso)).length;
    const preview = document.getElementById('export-students-preview');
    if (preview) preview.textContent = seleccionados.length === 0
        ? 'Selecciona al menos un curso'
        : `${total} alumno${total !== 1 ? 's' : ''} en ${seleccionados.length} curso${seleccionados.length !== 1 ? 's' : ''}`;
}

function cursosSeleccionados() {
    return [...document.querySelectorAll('.export-students-curso-check:checked')].map(cb => cb.value);
}

function confirmarExportStudents() {
    const cursos = cursosSeleccionados();
    if (cursos.length === 0) { alert('Selecciona al menos un curso'); return; }

    const formato = document.querySelector('input[name="export-students-formato"]:checked')?.value ?? 'xlsx';
    const fechaHoy = new Date().toISOString().slice(0, 10);

    if (formato === 'xlsx') {
        const params = new URLSearchParams();
        params.set('cursos', cursos.join('|'));
        const a = document.createElement('a');
        a.href = `${API_URL}/api/exportar/alumnos/filtrado?${params.toString()}`;
        a.download = `alumnos_${fechaHoy}.xlsx`;
        a.click();
    } else {
        const filtrados = estudiantesCache.filter(u => cursos.includes(u.curso));
        const filas = [['RUT', 'Nombre', 'Curso', 'PAE', 'Tiene Huella']];
        filtrados.forEach(u => filas.push([
            u.rut || '', u.nombre, u.curso,
            u.es_pae ? 'Sí' : 'No',
            u.tiene_huella ? 'Sí' : 'No'
        ]));
        const csv = filas.map(f => f.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alumnos_${fechaHoy}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    closeExportStudentsModal();
}

// ============================================
// MODAL REESCRIBIR HUELLA
// ============================================

let rhfWs = null;
let rhfSensorDisponible = false;

function _rhfShowStep(stepId) {
    ['rhf-step-ready', 'rhf-step-capturing', 'rhf-step-success', 'rhf-step-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const el = document.getElementById(stepId);
    if (el) el.style.display = 'flex';
}

async function openReescribirHuellaModal() {
    if (!currentStudent) return;
    closeEditModal();

    document.getElementById('rhf-nombre').textContent = currentStudent.nombre;
    document.getElementById('rhf-run').textContent = 'RUN: ' + (currentStudent.rut || 'Sin RUT');
    document.getElementById('rhf-curso').textContent = 'Curso: ' + currentStudent.curso;

    _rhfShowStep('rhf-step-ready');
    document.getElementById('reescribirHuellaModal').classList.add('active');

    // Verificar estado del sensor
    rhfSensorDisponible = false;
    const btn = document.getElementById('rhf-btn-iniciar');
    const hint = document.getElementById('rhf-sensor-hint');
    if (hint) hint.style.display = 'none';
    if (btn) { btn.disabled = true; btn.textContent = 'Verificando sensor...'; }
    try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(`${currentStudent._totem_url}/api/sensor/status`, { signal: ctrl.signal });
        const data = await res.json();
        rhfSensorDisponible = data.available === true;
    } catch {
        rhfSensorDisponible = false;
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Iniciar captura'; }
    if (!rhfSensorDisponible && hint) {
        hint.textContent = '⚠ Sensor desconectado. Conéctalo antes de continuar.';
        hint.style.display = 'block';
    }
}

function closeReescribirHuellaModal() {
    if (rhfWs) { rhfWs.onclose = null; rhfWs.close(); rhfWs = null; }
    document.getElementById('reescribirHuellaModal').classList.remove('active');
}

function cancelarCapturaHuella() {
    if (rhfWs) { rhfWs.onclose = null; rhfWs.close(); rhfWs = null; }
    _rhfShowStep('rhf-step-ready');
}

async function iniciarCapturaHuellaAdmin() {
    if (!currentStudent) return;

    // Verificar sensor justo antes de iniciar
    const btn = document.getElementById('rhf-btn-iniciar');
    const hint = document.getElementById('rhf-sensor-hint');
    if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
    if (hint) hint.style.display = 'none';

    let sensorOk = false;
    try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(`${currentStudent._totem_url}/api/sensor/verificar`, { signal: ctrl.signal });
        const data = await res.json();
        sensorOk = data.available === true;
    } catch {
        sensorOk = false;
    }

    if (!sensorOk) {
        if (btn) { btn.disabled = false; btn.textContent = 'Iniciar captura'; }
        if (hint) {
            hint.textContent = '⚠ El sensor de huella no está conectado. Conecta el hardware e intenta nuevamente.';
            hint.style.display = 'block';
        }
        return;
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Iniciar captura'; }
    _rhfShowStep('rhf-step-capturing');
    document.getElementById('rhf-capturing-msg').textContent = 'Esperando huella dactilar...';

    const wsBase = currentStudent._totem_url.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/ws/huella/editar/${currentStudent.id}`);
    rhfWs = ws;
    let responded = false;

    ws.onmessage = (event) => {
        responded = true;
        rhfWs = null;
        const data = JSON.parse(event.data);
        if (data.estado) {
            document.getElementById('rhf-success-msg').textContent =
                `La huella de ${currentStudent.nombre} fue actualizada correctamente.`;
            _rhfShowStep('rhf-step-success');
            cargarEstudiantes();
        } else {
            document.getElementById('rhf-error-msg').textContent =
                data.mensaje || 'No se pudo capturar la huella. Intenta nuevamente.';
            _rhfShowStep('rhf-step-error');
        }
    };

    ws.onerror = () => {
        if (!responded) {
            rhfWs = null;
            document.getElementById('rhf-error-msg').textContent = 'Error de conexión con el sensor.';
            _rhfShowStep('rhf-step-error');
        }
    };

    ws.onclose = () => {
        if (!responded) {
            rhfWs = null;
            document.getElementById('rhf-error-msg').textContent = 'La conexión se cerró inesperadamente.';
            _rhfShowStep('rhf-step-error');
        }
    };
}

function exportToExcel() {
    if (estudiantesCache.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    const filas = [['RUN', 'Nombre', 'Curso', 'Es PAE', 'Tiene Huella']];
    estudiantesCache.forEach(u => filas.push([u.rut || '', u.nombre, u.curso, u.es_pae ? 'Si' : 'No', u.tiene_huella ? 'Si' : 'No']));
    const csv = filas.map(f => f.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estudiantes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
