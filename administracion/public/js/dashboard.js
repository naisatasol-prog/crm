// js/dashboard.js — Admin
document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch, getUser, logout, showToast, requireAuth } = window.auth;
  requireAuth();

  const user = getUser();
  if (!user) return;

  document.getElementById('user-name').textContent    = user.nombre;
  document.getElementById('user-avatar').textContent  = user.nombre[0].toUpperCase();

  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault(); logout();
  });

  async function cargarDatos() {
    try {
      const res = await apiFetch('/usuarios/stats/dashboard');
      document.getElementById('kpi-clientes').textContent = res.totalClientes;
      document.getElementById('kpi-tickets').textContent  = res.totalTickets;
      document.getElementById('kpi-abiertos').textContent = res.ticketsAbiertos;
      document.getElementById('kpi-proceso').textContent  = res.ticketsEnProceso;
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  document.getElementById('refresh-btn').addEventListener('click', cargarDatos);
  cargarDatos();
});
