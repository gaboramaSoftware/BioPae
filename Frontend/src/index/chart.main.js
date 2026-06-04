// ============================================
// GRÁFICO DE BARRAS — RACIONES POR CURSO (HTML/CSS)
// ============================================

let _ultimosRegistros = [];

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function _toStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function _fechaHoy() {
    return _toStr(new Date());
}

/** Retorna { desde, hasta } en "YYYY-MM-DD" según el período seleccionado */
function _rangoActual() {
    const select  = document.getElementById('chart-periodo-filter');
    const periodo = select ? select.value : 'hoy';
    const hoy     = new Date();

    if (periodo === 'semana') {
        // Lunes de la semana actual
        const dow   = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; // 0 = lunes
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - dow);
        return { desde: _toStr(lunes), hasta: _toStr(hoy), label: '— Esta semana' };
    }

    if (periodo === 'mes') {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        return { desde: _toStr(primero), hasta: _toStr(hoy), label: '— Este mes' };
    }

    // 'hoy' por defecto
    const s = _toStr(hoy);
    return { desde: s, hasta: s, label: '— Hoy' };
}

// ── Helpers de cursos ─────────────────────────────────────────────────────────

/** "1 Basico A" → "1 Basico" | "Kinder A" → "Kinder" */
function _extractNivel(curso) {
    if (!curso || curso === 'Sin curso') return '';
    const p = curso.trim().split(' ');
    return p.length > 1 ? p.slice(0, -1).join(' ') : curso;
}

/** Orden canónico: Pre-Kinder → Kinder → 1-8 Basico → 1-4 Medio */
function _ordenNivel(n) {
    if (n === 'Pre-Kinder') return 0;
    if (n === 'Kinder')     return 1;
    const p = n.split(' ');
    const num = parseInt(p[0]) || 0;
    if (p[1] === 'Basico') return 2 + num;
    if (p[1] === 'Medio')  return 11 + num;
    return 99;
}

function _abreviarCurso(nombre) {
    if (!nombre || nombre === 'Sin curso') return 'S/C';
    const n = nombre.trim();
    if (/^pre-?kinder/i.test(n)) return `PK·${n.split(' ').pop()}`;
    if (/^kinder/i.test(n))      return `K·${n.split(' ').pop()}`;
    const p = n.split(' ');
    if (p.length >= 3) return `${p[0]}${p[1][0].toUpperCase()}·${p[p.length-1]}`;
    return n.slice(0, 7);
}

// ── API PÚBLICA ───────────────────────────────────────────────────────────────

/** Llamado desde app.js cuando llegan los datos */
function renderGraficoCursos(registros) {
    _ultimosRegistros = registros || [];
    _poblarSelect(_ultimosRegistros);
    _dibujarGrafico(_ultimosRegistros);
}

/** Llamado desde onchange de cualquiera de los dos selects */
function renderGraficoCursosFiltrado() {
    _poblarSelect(_ultimosRegistros); // re-poblar por si cambió el período
    _dibujarGrafico(_ultimosRegistros);
}

// ── LÓGICA INTERNA ────────────────────────────────────────────────────────────

function _poblarSelect(registros) {
    const select = document.getElementById('chart-nivel-filter');
    if (!select) return;

    const { desde, hasta } = _rangoActual();
    const enRango = registros.filter(r => r.fecha >= desde && r.fecha <= hasta && r.estado === 'Aprobado');

    const nivelesSet = new Set();
    enRango.forEach(r => {
        const nv = _extractNivel(r.curso);
        if (nv) nivelesSet.add(nv);
    });

    const niveles = [...nivelesSet].sort((a, b) => _ordenNivel(a) - _ordenNivel(b));

    const valorActual = select.value;
    select.innerHTML = '<option value="">Todos los cursos</option>' +
        niveles.map(n => `<option value="${n}"${n === valorActual ? ' selected' : ''}>${n}</option>`).join('');
}

function _dibujarGrafico(registros) {
    const container = document.getElementById('chart-cursos-container');
    if (!container) return;

    const { desde, hasta, label } = _rangoActual();

    // Actualizar el subtítulo de la card
    const labelEl = document.getElementById('chart-periodo-label');
    if (labelEl) labelEl.textContent = label;

    // Filtro de nivel
    const nivelSelect  = document.getElementById('chart-nivel-filter');
    const nivelFiltro  = nivelSelect ? nivelSelect.value : '';

    // Filtrar por rango de fechas + estado aprobado
    let enRango = registros.filter(r => r.fecha >= desde && r.fecha <= hasta && r.estado === 'Aprobado');

    if (nivelFiltro) {
        enRango = enRango.filter(r => _extractNivel(r.curso) === nivelFiltro);
    }

    // ── Estado vacío ──────────────────────────────────────────────────────────
    if (enRango.length === 0) {
        const periodoSelect = document.getElementById('chart-periodo-filter');
        const periodo       = periodoSelect ? periodoSelect.value : 'hoy';
        const periodoLabel  = { hoy: 'hoy', semana: 'esta semana', mes: 'este mes' }[periodo] || 'hoy';
        const nivelLabel    = nivelFiltro ? ` de ${nivelFiltro}` : '';

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                        height:160px;gap:8px;">
                <span style="font-size:2rem;line-height:1;">📊</span>
                <span style="font-size:0.85rem;color:#94a3b8;">Sin raciones${nivelLabel} registradas ${periodoLabel}</span>
                <span style="font-size:0.72rem;color:#475569;">${desde === hasta ? desde : `${desde} → ${hasta}`}</span>
            </div>`;
        return;
    }

    // ── Agrupar por curso (acumulando todo el período) ────────────────────────
    const mapa = {};
    enRango.forEach(r => {
        const c = r.curso || 'Sin curso';
        if (!mapa[c]) mapa[c] = { d: 0, a: 0 };
        if (r.racion === 'desayuno')  mapa[c].d++;
        else if (r.racion === 'almuerzo') mapa[c].a++;
    });

    const cursos = Object.keys(mapa).sort((a, b) => {
        const letraA = a.split(' ').pop(), letraB = b.split(' ').pop();
        if (letraA !== letraB) return letraA.localeCompare(letraB, 'es');
        return a.localeCompare(b, 'es');
    });

    const maxVal = Math.max(...cursos.map(c => Math.max(mapa[c].d, mapa[c].a)), 1);

    // ── Renderizar barras ─────────────────────────────────────────────────────
    // Escala raíz cuadrada: preserva el orden pero amplifica diferencias pequeñas,
    // haciendo que 2 vs 13 sea visualmente muy distinguible para el administrador.
    const _escala = v => v === 0 ? 0 : (Math.sqrt(v / maxVal) * 100).toFixed(1);

    const barrasHTML = cursos.map(c => {
        const { d, a } = mapa[c];
        const pctD = _escala(d);
        const pctA = _escala(a);

        const barD = `
            <div style="display:flex;flex-direction:column;align-items:center;
                        justify-content:flex-end;flex:1;min-width:0;">
                ${d > 0 ? `<span style="font-size:9px;color:#e2e8f0;margin-bottom:2px;font-weight:600;">${d}</span>` : ''}
                <div style="background:#f59e0b;width:100%;height:${pctD}%;
                            border-radius:3px 3px 0 0;min-height:${d > 0 ? 8 : 0}px;"></div>
            </div>`;

        const barA = `
            <div style="display:flex;flex-direction:column;align-items:center;
                        justify-content:flex-end;flex:1;min-width:0;">
                ${a > 0 ? `<span style="font-size:9px;color:#e2e8f0;margin-bottom:2px;font-weight:600;">${a}</span>` : ''}
                <div style="background:#3b82f6;width:100%;height:${pctA}%;
                            border-radius:3px 3px 0 0;min-height:${a > 0 ? 8 : 0}px;"></div>
            </div>`;

        return `
            <div style="flex:1;min-width:28px;max-width:80px;display:flex;flex-direction:column;align-items:stretch;">
                <div style="display:flex;align-items:flex-end;gap:2px;height:240px;padding:0 3px;">
                    ${barD}${barA}
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:3px;padding-top:4px;
                            text-align:center;font-size:8.5px;color:#64748b;line-height:1.3;">
                    ${_abreviarCurso(c)}
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:4px;width:100%;overflow-x:auto;">
            ${barrasHTML}
        </div>
        <div style="display:flex;gap:14px;margin-top:10px;padding-top:8px;
                    border-top:1px solid rgba(255,255,255,0.06);">
            <span style="display:flex;align-items:center;gap:5px;font-size:10px;color:#94a3b8;">
                <span style="display:inline-block;width:10px;height:10px;background:#f59e0b;
                             border-radius:2px;flex-shrink:0;"></span>Desayuno
            </span>
            <span style="display:flex;align-items:center;gap:5px;font-size:10px;color:#94a3b8;">
                <span style="display:inline-block;width:10px;height:10px;background:#3b82f6;
                             border-radius:2px;flex-shrink:0;"></span>Almuerzo
            </span>
        </div>`;
}
