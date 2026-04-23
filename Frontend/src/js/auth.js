document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    // Mostrar/ocultar contraseña
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const esPassword = passwordInput.type === 'password';
            passwordInput.type = esPassword ? 'text' : 'password';
            toggleBtn.textContent = esPassword ? '🙈' : '👁️';
        });
    }

    // Submit del formulario
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rut = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const submitBtn = document.getElementById('submitBtn');

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
