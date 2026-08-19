// js/dashboard.js — Portal Clientes
document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch, getUser, logout, showToast, requireAuth } = window.auth;
  requireAuth();

  const user = getUser();
  if (!user) return;

  // Cargar info de usuario en UI
  document.getElementById('user-name').textContent    = user.nombre;
  document.getElementById('user-avatar').textContent  = user.nombre[0].toUpperCase();
  document.getElementById('welcome-name').textContent = user.nombre.split(' ')[0];
  document.getElementById('empresa-nombre').textContent = user.cliente?.empresa || (user.rol === 'admin' ? 'Vista Admin' : 'Mi Empresa');

  // Fecha actual
  const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('topbar-fecha').textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault(); logout();
  });

  // Plan
  const planFeatures = {
    basico:       ['5 Tickets/mes', 'Soporte por email', 'Horario 9-18h'],
    profesional:  ['Tickets ilimitados', 'Soporte prioritario', 'Respuesta < 4h'],
    enterprise:   ['Tickets ilimitados', 'Soporte 24/7', 'Técnico dedicado', 'SLA garantizado'],
    admin:        ['Acceso total', 'Vista global', 'Control administrativo']
  };
  const planNombre = user.rol === 'admin' ? 'admin' : (user.cliente?.plan || 'basico');
  document.getElementById('plan-nombre').textContent = planNombre.charAt(0).toUpperCase() + planNombre.slice(1);
  const pf = document.getElementById('plan-features');
  (planFeatures[planNombre] || planFeatures.basico).forEach(f => {
    const d = document.createElement('div');
    d.className = 'plan-feature';
    d.textContent = f;
    pf.appendChild(d);
  });

  // Cargar datos
  try {
    const [tkRes, cotRes] = await Promise.all([
      apiFetch('/tickets'),
      apiFetch('/cotizaciones'),
    ]);

    const tickets      = tkRes.tickets  || [];
    const cotizaciones = cotRes.cotizaciones || [];

    // KPIs
    document.getElementById('kpi-abiertos').textContent     = tickets.filter(t => t.estado === 'abierto').length;
    document.getElementById('kpi-proceso').textContent      = tickets.filter(t => t.estado === 'en_proceso').length;
    document.getElementById('kpi-resueltos').textContent    = tickets.filter(t => t.estado === 'resuelto').length;
    document.getElementById('kpi-cotizaciones').textContent = cotizaciones.length;

    // Tickets recientes
    const tList = document.getElementById('tickets-list');
    if (tickets.length === 0) {
      tList.innerHTML = `<div class="empty-state"><div class="empty-icon">🎫</div><div class="empty-text">No tienes tickets aún</div></div>`;
    } else {
      tList.innerHTML = tickets.slice(0, 5).map(t => `
        <div class="ticket-row">
          <div class="ticket-info">
            <div class="t-title">${t.folio} — ${t.titulo}</div>
            <div class="t-meta">${t.categoria} · ${new Date(t.createdAt).toLocaleDateString('es-MX')}</div>
          </div>
          <span class="badge ${badgeEstado(t.estado)}">${estadoLabel(t.estado)}</span>
        </div>
      `).join('');
    }

    // Actividad
    const aList = document.getElementById('activity-list');
    const actividades = [
      { msg: 'Sesión iniciada', time: 'Ahora', dot: 'primary' },
      ...tickets.slice(0, 2).map(t => ({
        msg: `Ticket ${t.folio} — ${t.titulo}`,
        time: new Date(t.updatedAt).toLocaleDateString('es-MX'),
        dot: t.estado === 'resuelto' ? 'success' : t.prioridad === 'alta' ? 'warning' : 'primary',
      })),
    ];
    aList.innerHTML = actividades.map(a => `
      <div class="activity-item">
        <div class="activity-dot ${a.dot}"></div>
        <div class="activity-body"><div class="a-msg">${a.msg}</div><div class="a-time">${a.time}</div></div>
      </div>
    `).join('');

  } catch (err) {
    showToast('Error cargando datos: ' + err.message, 'error');
  }

  document.getElementById('refresh-btn').addEventListener('click', () => location.reload());
});

function badgeEstado(e) {
  return { abierto: 'badge-primary', en_proceso: 'badge-warning', resuelto: 'badge-success', cerrado: 'badge-muted' }[e] || 'badge-muted';
}
function estadoLabel(e) {
  return { abierto: 'Abierto', en_proceso: 'En Proceso', resuelto: 'Resuelto', cerrado: 'Cerrado' }[e] || e;
}
