// js/auth.js â€” Portal Clientes
// URL absoluta del servidor para que funcione abriendo el HTML desde file://
const API = 'https://simuladorrender.com/api';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function setToken(token) { localStorage.setItem('pt_token', token); }
function getToken()      { return localStorage.getItem('pt_token'); }
function setUser(user)   { localStorage.setItem('pt_user', JSON.stringify(user)); }
function getUser()       { try { return JSON.parse(localStorage.getItem('pt_user')); } catch { return null; } }
function logout()        { localStorage.removeItem('pt_token'); localStorage.removeItem('pt_user'); window.location.href = 'index.html'; }

// â”€â”€ Auth check (en pÃ¡ginas protegidas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function requireAuth() {
  const token = getToken();
  if (!token) { window.location.href = 'index.html'; return null; }
  return token;
}

// â”€â”€ API helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const { headers, ...restOpts } = opts;
  const res = await fetch(API + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...restOpts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

// â”€â”€ Login Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const loginForm = document.getElementById('login-form');
if (loginForm) {
  // Si ya tiene sesiÃ³n activa, redirigir
  if (getToken()) window.location.href = 'dashboard.html';

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email     = document.getElementById('email').value.trim();
    const password  = document.getElementById('password').value;
    const btnText   = document.getElementById('btn-text');
    const btnSpin   = document.getElementById('btn-spin');
    const errorDiv  = document.getElementById('error-msg');
    const errorText = document.getElementById('error-text');

    errorDiv.style.display = 'none';
    btnText.style.display = 'none';
    btnSpin.style.display = 'inline';

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (data.usuario.rol !== 'cliente' && data.usuario.rol !== 'admin') {
        throw new Error('Rol no autorizado para acceder a este portal.');
      }

      setToken(data.token);
      setUser(data.usuario);
      showToast('âœ… Bienvenido, ' + data.usuario.nombre);
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
    } catch (err) {
      errorText.textContent = err.message;
      errorDiv.style.display = 'flex';
      btnText.style.display = 'inline';
      btnSpin.style.display = 'none';
    }
  });
}

// Exponer
window.auth = { apiFetch, getToken, getUser, setToken, setUser, logout, requireAuth, showToast };
