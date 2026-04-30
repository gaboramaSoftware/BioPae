// ============================================
// ACCESO POR HUELLA EN PANTALLA DE AUTH
// ============================================

let _authFpWs = null;
let _authFpActive = true;

function _setFpStatus(msg, color) {
    const dot = document.getElementById('fp-auth-dot');
    const txt = document.getElementById('fp-auth-status');
    if (txt) txt.textContent = msg;
    if (dot && color) dot.style.background = color;
}

async function _iniciarEscaneoHuella() {
    if (!_authFpActive || _authFpWs) return;

    _setFpStatus('Coloca el dedo en el sensor para acceder como admin', '#22c55e');

    const ws = new WebSocket('ws://localhost:8080/ws/totem');
    _authFpWs = ws;

    ws.onmessage = (event) => {
        _authFpWs = null;
        const data = JSON.parse(event.data);
        if (data.estado === 'Admin') {
            _setFpStatus('¡Admin detectado! Ingresando...', '#22c55e');
            window.location.href = 'menu.html';
        } else {
            _setFpStatus('Huella no autorizada. Intenta de nuevo o usa credenciales.', '#f59e0b');
            setTimeout(() => {
                if (_authFpActive) {
                    _setFpStatus('Coloca el dedo en el sensor para acceder como admin', '#22c55e');
                    _iniciarEscaneoHuella();
                }
            }, 2500);
        }
    };

    ws.onerror = () => {
        if (_authFpWs === ws) {
            _authFpWs = null;
            if (_authFpActive) setTimeout(_iniciarEscaneoHuella, 3000);
        }
    };

    ws.onclose = () => {
        if (_authFpWs === ws) {
            _authFpWs = null;
            if (_authFpActive) setTimeout(_iniciarEscaneoHuella, 500);
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    _iniciarEscaneoHuella();

    // Mostrar/ocultar contraseña
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const esPassword = passwordInput.type === 'password';
            passwordInput.type = esPassword ? 'text' : 'password';
            toggleBtn.innerHTML = esPassword ? '<ion-icon name="eye"></ion-icon>' : '<ion-icon name="eye-off-outline"></ion-icon>';
        });
    }

    // Submit del formulario
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rut = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const submitBtn = document.getElementById('submitBtn');

            _authFpActive = false;
            if (_authFpWs) { _authFpWs.onclose = null; _authFpWs.close(); _authFpWs = null; }
            submitBtn.textContent = 'Verificando...';
            submitBtn.disabled = true;
            ocultarError();

            try {
                // Usar IPC de Electron si está disponible, si no llamar al backend directamente
                let resultado;
                if (window.totem && window.totem.login) {
                    resultado = await window.totem.login(rut, password);
                } else {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rut, password })
                    });
                    resultado = await res.json();
                }

                if (resultado.success) {
                    window.location.href = 'menu.html';
                } else {
                    mostrarError(resultado.error || 'Usuario o contraseña incorrectos');
                    submitBtn.textContent = 'Iniciar Sesión';
                    submitBtn.disabled = false;
                }
            } catch (err) {
                mostrarError('Error de conexión. Intente nuevamente.');
                submitBtn.textContent = 'Iniciar Sesión';
                submitBtn.disabled = false;
            }
        });
    }
});

function mostrarError(msg) {
    let errEl = document.getElementById('error-msg');
    if (!errEl) {
        errEl = document.createElement('div');
        errEl.id = 'error-msg';
        errEl.className = 'error-msg';
        document.getElementById('loginForm').prepend(errEl);
    }
    errEl.textContent = msg;
    errEl.classList.add('visible');
}

function ocultarError() {
    const errEl = document.getElementById('error-msg');
    if (errEl) errEl.classList.remove('visible');
}
