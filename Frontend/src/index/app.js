const API_URL = 'http://localhost:8080';

let estudiantesCache = [];
let currentStudent = null;
let enrollPollingInterval = null;
let enrollingUserId = null;   // ID del usuario creado pero aún sin huella confirmada
let enrollWs = null;          // WebSocket activo de enrolamiento




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
}

// ============================================
// DASHBOARD
// ============================================

async function cargarDashboard() {
    try {
        const res = await fetch(`${API_URL}/api/registros/hoy`);
        const data = await res.json();
        document.getElementById('count-breakfast').textContent = data.desayunos ?? 0;
        document.getElementById('count-lunch').textContent = data.almuerzos ?? 0;
        document.getElementById('count-total').textContent = data.total ?? 0;
    } catch (e) {
        console.error('[DASHBOARD] Error al cargar stats:', e.message);
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
        const res = await fetch(`${API_URL}/api/usuarios`);
        estudiantesCache = await res.json();
        renderTablaEstudiantes(estudiantesCache);
    } catch (e) {
        console.error('[ESTUDIANTES] Error al cargar:', e.message);
        document.getElementById('students-body').innerHTML = '<tr><td colspan="4" class="text-center">Error al cargar datos</td></tr>';
    }
}

function renderTablaEstudiantes(lista) {
    const tbody = document.getElementById('students-body');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay estudiantes registrados</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(u => `
        <tr>
            <td>${u.rut || 'Sin RUT'}</td>
            <td>${u.nombre}</td>
            <td>${u.curso}</td>
            <td>${u.es_pae ? '<span class="badge-pae">PAE</span>' : '<span class="badge-no-pae">No PAE</span>'}</td>
            <td>
                <button class="btn-action btn-stats" onclick="openStudentStats(${u.id})">Ver</button>
            </td>
        </tr>
    `).join('');
}

function filterStudentsTable() {
    const q = document.getElementById('search-students-input').value.toLowerCase();
    const filtrados = estudiantesCache.filter(u =>
        u.nombre.toLowerCase().includes(q) || (u.rut && u.rut.toLowerCase().includes(q))
    );
    renderTablaEstudiantes(filtrados);
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
    const nivel = document.getElementById('nivel-filter').value;
    const letra = document.getElementById('letra-filter').value;

    if (!nivel && !letra) {
        renderTablaEstudiantes(estudiantesCache);
        return;
    }

    if (!nivel || !letra) {
        const tbody = document.getElementById('students-body');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Este curso no existe</td></tr>';
        return;
    }

    // u.curso viene como "1 Basico A" → coincide exactamente con `${nivel} ${letra}`
    const filtrados = estudiantesCache.filter(u => u.curso === `${nivel} ${letra}`);
    renderTablaEstudiantes(filtrados);
}

// ============================================
// MODAL ENROLAR
// ============================================

async function openEnrollModal() {
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
    document.getElementById('enrollModal').classList.remove('active');
    document.getElementById('enrollForm').reset();
    const submitBtn = document.getElementById('enrollForm')?.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.textContent = 'Enrolar Estudiante'; submitBtn.disabled = false; }
}

async function handleEnrollStudent(event) {
    event.preventDefault();

    const nombre    = document.getElementById('enroll-nombre').value.trim();
    const apellido  = document.getElementById('enroll-apellido').value.trim();
    const cursoId   = parseInt(document.getElementById('enroll-curso').value);
    const esPae     = document.getElementById('enroll-pae')?.checked ?? false;
    const inputRut  = document.getElementById('enroll-rut')?.value.trim() ?? '';

    if (!nombre || !apellido || !cursoId) {
        alert('Completa nombre, apellido y curso.');
        return;
    }

    let rutFinal;
    if (inputRut !== '') {
        if (!validarRut(inputRut)) {
            alert('El RUT ingresado no es válido. Corrígelo o déjalo en blanco para generarlo automáticamente.');
            return;
        }
        rutFinal = inputRut;
    } else {
        rutFinal = generarRutAleatorio();
    }

    const submitBtn = event.target.querySelector('[type="submit"]');
    submitBtn.textContent = 'Creando usuario...';
    submitBtn.disabled = true;

    try {
        // Paso 1: Crear usuario SIN hardware
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

        // Paso 2: verificar si es duplicado
        if (resData.duplicado) {
            const accion = resData.tiene_huella
                ? `El alumno "${resData.nombre}" ya está registrado y tiene huella. ¿Deseas sobrescribir su huella?`
                : `El alumno "${resData.nombre}" ya está registrado sin huella. ¿Deseas asignarle una ahora?`;

            const confirmar = confirm(accion);
            if (!confirmar) {
                submitBtn.textContent = 'Enrolar Estudiante';
                submitBtn.disabled = false;
                return;
            }
            // Usuario ya existe → no marcar enrollingUserId (no eliminar si se cierra el modal)
        } else {
            enrollingUserId = usuarioId;  // usuario nuevo → eliminar si se cierra el modal
        }

        // Paso 3: Capturar huella vía WebSocket
        // Duplicado → editar (sobrescribir huella), nuevo → enrolar
        submitBtn.textContent = 'Ponga el dedo en el sensor...';
        const wsEndpoint = resData.duplicado
            ? `ws://localhost:8080/ws/huella/editar/${usuarioId}`
            : `ws://localhost:8080/ws/huella/enrolar/${usuarioId}`;

        const ws = new WebSocket(wsEndpoint);
        enrollWs = ws;
        let responded = false;

        ws.onmessage = (event) => {
            responded = true;
            enrollWs = null;
            const data = JSON.parse(event.data);

            if (data.estado) {
                enrollingUserId = null;  // huella confirmada, no eliminar
                const msg = resData.duplicado
                    ? `✓ Huella de ${nombre} ${apellido} actualizada exitosamente.`
                    : `✓ Estudiante ${nombre} ${apellido} enrolado exitosamente.`;
                alert(msg);
                closeEnrollModal();
                cargarEstudiantes();
            } else {
                alert('Error al capturar la huella: ' + (data.mensaje || 'Intente nuevamente.'));
                submitBtn.textContent = 'Enrolar Estudiante';
                submitBtn.disabled = false;
                // enrollingUserId sigue seteado si era nuevo → closeEnrollModal lo eliminará
            }
        };

        ws.onerror = () => {
            if (!responded) {
                enrollWs = null;
                alert('Error de conexión con el sensor.');
                submitBtn.textContent = 'Enrolar Estudiante';
                submitBtn.disabled = false;
            }
        };

        ws.onclose = () => {
            if (!responded) {
                enrollWs = null;
                submitBtn.textContent = 'Enrolar Estudiante';
                submitBtn.disabled = false;
            }
        };

    } catch (e) {
        console.error('[ENROLAR] Error:', e.message);
        alert('Error de conexión al enrolar');
        submitBtn.textContent = 'Enrolar Estudiante';
        submitBtn.disabled = false;
    }
}

// ============================================
// MODAL ESTADÍSTICAS
// ============================================

async function openStudentStats(userId) {
    currentStudent = estudiantesCache.find(u => u.id === userId);
    if (!currentStudent) return;

    document.getElementById('stats-avatar-letter').textContent = currentStudent.nombre[0].toUpperCase();
    document.getElementById('stats-student-name').textContent = currentStudent.nombre;
    document.getElementById('stats-student-run').textContent = 'RUN: ' + (currentStudent.rut || 'Sin RUT');
    document.getElementById('stats-student-curso').textContent = 'Curso: ' + currentStudent.curso;
    document.getElementById('stats-student-pae').textContent = 'PAE: ' + (currentStudent.es_pae ? 'Sí' : 'No');

    // Cargar historial para calcular stats
    try {
        const res = await fetch(`${API_URL}/api/usuarios/${userId}/historial`);
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

// ============================================
// MODAL DETALLE
// ============================================

async function openDetalleModal() {
    if (!currentStudent) return;
    closeStatsModal();

    document.getElementById('detalle-student-name').textContent = currentStudent.nombre;
    document.getElementById('detalle-student-run').textContent = 'RUN: ' + (currentStudent.rut || 'Sin RUT');

    try {
        const res = await fetch(`${API_URL}/api/usuarios/${currentStudent.id}/historial`);
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
        await fetch(`${API_URL}/api/usuarios/${currentStudent.id}`, {
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
        const res = await fetch(`${API_URL}/api/usuarios/${currentStudent.id}`, { method: 'DELETE' });
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

const DASHBOARD_MAX_REGISTROS = 20;
let registrosCache = [];

async function cargarRegistros() {
    try {
        const res = await fetch(`${API_URL}/api/registros`);
        registrosCache = await res.json();
        renderTablaRegistros(registrosCache.slice(0, DASHBOARD_MAX_REGISTROS), 'records-body');
        renderTablaRegistros(registrosCache, 'reports-body');
    } catch (e) {
        console.error('[REGISTROS] Error al cargar:', e.message);
        const msg = '<tr><td colspan="5" class="text-center">Error al cargar registros</td></tr>';
        document.getElementById('records-body').innerHTML = msg;
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

function filterDashboardTable() {
    const q = document.getElementById('search-input')?.value.toLowerCase() ?? '';
    const filtrados = registrosCache.filter(r =>
        r.estudiante.toLowerCase().includes(q) || (r.rut && r.rut.toLowerCase().includes(q))
    );
    renderTablaRegistros(filtrados.slice(0, DASHBOARD_MAX_REGISTROS), 'records-body');
}

function filterReportsTable() {
    const q = document.getElementById('search-reports-input')?.value.toLowerCase() ?? '';
    const filtrados = registrosCache.filter(r =>
        r.estudiante.toLowerCase().includes(q) || (r.rut && r.rut.toLowerCase().includes(q))
    );
    renderTablaRegistros(filtrados, 'reports-body');
}

function openExportModal() {
    if (registrosCache.length === 0) {
        alert('No hay registros para exportar');
        return;
    }

    // Poblar cursos únicos desde el cache
    const cursos = [...new Set(registrosCache.map(r => r.curso).filter(Boolean))].sort();
    const selectCurso = document.getElementById('export-curso');
    selectCurso.innerHTML = '<option value="">Todos los cursos</option>' +
        cursos.map(c => `<option value="${c}">${c}</option>`).join('');

    // Poblar raciones únicas desde el cache
    const raciones = [...new Set(registrosCache.map(r => r.racion).filter(Boolean))].sort();
    const selectRacion = document.getElementById('export-racion');
    selectRacion.innerHTML = '<option value="">Todas las raciones</option>' +
        raciones.map(r => `<option value="${r}">${r}</option>`).join('');

    // Resetear fechas y preview
    document.getElementById('export-fecha-desde').value = '';
    document.getElementById('export-fecha-hasta').value = '';
    actualizarPreviewExport();

    // Actualizar preview al cambiar cualquier filtro
    ['export-curso', 'export-racion', 'export-fecha-desde', 'export-fecha-hasta'].forEach(id => {
        document.getElementById(id).onchange = actualizarPreviewExport;
    });

    document.getElementById('exportModal').classList.add('active');
}

function closeExportModal() {
    document.getElementById('exportModal').classList.remove('active');
}

function aplicarFiltrosExport() {
    const curso  = document.getElementById('export-curso').value;
    const racion = document.getElementById('export-racion').value;
    const desde  = document.getElementById('export-fecha-desde').value;
    const hasta  = document.getElementById('export-fecha-hasta').value;

    return registrosCache.filter(r => {
        if (curso  && r.curso  !== curso)  return false;
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

    // Nombre de archivo refleja los filtros aplicados
    const curso  = document.getElementById('export-curso').value.replace(/\s+/g, '_') || 'todos';
    const racion = document.getElementById('export-racion').value || 'todas';
    const desde  = document.getElementById('export-fecha-desde').value;
    const hasta  = document.getElementById('export-fecha-hasta').value;
    const rango  = desde || hasta ? `_${desde || ''}a${hasta || ''}` : '';
    a.download = `registros_${curso}_${racion}${rango}_${new Date().toISOString().slice(0, 10)}.csv`;

    a.click();
    URL.revokeObjectURL(url);
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

    // Ordenar y filtrar por curso
    const sorted = [...estudiantesCache]
        .sort((a, b) => a.curso.localeCompare(b.curso) || a.nombre.localeCompare(b.nombre))
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

async function exportarListaJUNAEB() {
    try {
        const generar = await fetch(`${API_URL}/api/exportar/alumnos`, { method: 'POST' });
        if (!generar.ok) throw new Error('Error al generar el archivo');
        const descargar = await fetch(`${API_URL}/api/descargar/alumnos`);
        if (!descargar.ok) throw new Error('Error al descargar el archivo');
        const blob = await descargar.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alumnos_sistema_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Error al exportar: ' + err.message);
    }
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
