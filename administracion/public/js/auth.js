// js/auth.js â€” Portal AdministraciÃ³n
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

function setToken(token) { localStorage.setItem('pt_admin_token', token); }
function getToken()      { return localStorage.getItem('pt_admin_token'); }
function setUser(user)   { localStorage.setItem('pt_admin_user', JSON.stringify(user)); }
function getUser()       { try { return JSON.parse(localStorage.getItem('pt_admin_user')); } catch { return null; } }
function logout()        { localStorage.removeItem('pt_admin_token'); localStorage.removeItem('pt_admin_user'); window.location.href = 'index.html'; }

// â”€â”€ Auth check (en pÃ¡ginas protegidas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function requireAuth() {
  const token = getToken();
  if (!token) { window.location.href = 'index.html'; return null; }
  return token;
}

// â”€â”€ API helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CachÃ© en sessionStorage para peticiones GET: evita llamadas duplicadas a Atlas
// dentro de la misma pestaÃ±a/sesiÃ³n. TTL: 30 segundos.
const _apiCache = {};
const API_CACHE_TTL = 30_000; // 30s

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const method = (opts.method || 'GET').toUpperCase();

  // Solo cachear GETs sin body
  const cacheKey = 'apicache:' + path;
  if (method === 'GET') {
    const cached = _apiCache[cacheKey];
    if (cached && (Date.now() - cached.ts) < API_CACHE_TTL) {
      return cached.data;
    }
  }

  const { headers, ...restOpts } = opts;
  const isFormData = opts.body instanceof FormData;
  const res = await fetch(API + path, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...restOpts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de servidor');

  // Guardar en cachÃ© si fue GET exitoso
  if (method === 'GET') {
    _apiCache[cacheKey] = { ts: Date.now(), data };
  } else {
    // Invalidar cachÃ© relacionada al mutar datos
    Object.keys(_apiCache).forEach(k => { if (k.includes(path.split('/')[1])) delete _apiCache[k]; });
  }

  return data;
}

// Exponer funciÃ³n para invalidar cachÃ© manualmente desde cualquier mÃ³dulo
function invalidarCache(prefijo) {
  Object.keys(_apiCache).forEach(k => { if (!prefijo || k.includes(prefijo)) delete _apiCache[k]; });
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

      if (data.usuario.rol !== 'admin') {
        throw new Error('Acceso denegado. Este portal es solo para administradores.');
      }

      setToken(data.token);
      setUser(data.usuario);
      showToast('âœ… Bienvenido, Administrador ' + data.usuario.nombre);
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
    } catch (err) {
      errorText.textContent = err.message;
      errorDiv.style.display = 'flex';
      btnText.style.display = 'inline';
      btnSpin.style.display = 'none';
    }
  });
}

window.auth = { apiFetch, getToken, getUser, setToken, setUser, logout, requireAuth, showToast, invalidarCache };
