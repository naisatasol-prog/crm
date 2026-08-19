// js/cotizaciones.js — Admin
document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch, getUser, logout, showToast, requireAuth } = window.auth;
  requireAuth();
  
  const user = getUser();
  if (!user) return;
  document.getElementById('user-name').textContent = user.nombre;
  document.getElementById('user-avatar').textContent = user.nombre[0].toUpperCase();
  document.getElementById('logout-btn').addEventListener('click', e => { e.preventDefault(); logout(); });

  let clientesList = [];

  async function cargarDatos() {
    try {
      const [resCot, resCli] = await Promise.all([
        apiFetch('/cotizaciones'),
        apiFetch('/clientes')
      ]);
      clientesList = resCli.clientes || [];
      renderCotizaciones(resCot.cotizaciones || []);
      
      const selCliente = document.getElementById('cot-cliente');
      selCliente.innerHTML = '<option value="">Selecciona un cliente...</option>' + 
        clientesList.map(c => `<option value="${c._id}">${c.empresa}</option>`).join('');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  function renderCotizaciones(cots) {
    const list = document.getElementById('cotizaciones-list');
    if (!cots.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-text">No hay cotizaciones registradas</div></div>`;
      return;
    }
    list.innerHTML = cots.map(c => `
      <div class="cot-card">
        <div class="cot-info">
          <div class="folio">${c.folio}</div>
          <div class="titulo">${c.titulo}</div>
          <div class="meta">${c.cliente?.empresa} · Creado: ${new Date(c.createdAt).toLocaleDateString('es-MX')}</div>
        </div>
        <div class="cot-right">
          <span class="badge ${badgeEstadoCot(c.estado)}" style="margin-bottom:8px;display:inline-flex;cursor:pointer;" onclick="cambiarEstadoCot('${c._id}', '${c.estado}')" title="Clic para cambiar estado">${c.estado} ✎</span>
          <div class="cot-total">$${c.total.toLocaleString('es-MX', {minimumFractionDigits:2})}</div>
        </div>
      </div>
    `).join('');
  }

  // ── Modal Crear Cotización ────────────────────────────────
  const modal = document.getElementById('modal-cot');
  const form = document.getElementById('form-cot');
  
  document.getElementById('btn-nueva-cot').addEventListener('click', () => {
    form.reset();
    document.getElementById('partidas-container').innerHTML = '';
    agregarPartida(); // Al menos una por defecto
    modal.classList.add('open');
  });
  
  document.getElementById('close-modal-cot').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('cancel-cot').addEventListener('click', () => modal.classList.remove('open'));

  function agregarPartida() {
    const div = document.createElement('div');
    div.className = 'partida-row';
    div.innerHTML = `
      <input type="text" class="form-control p-desc" placeholder="Descripción del servicio/producto" required />
      <input type="number" class="form-control p-cant" placeholder="Cant." min="1" value="1" required />
      <input type="number" class="form-control p-precio" placeholder="Precio U." min="0" step="0.01" required />
      <button type="button" class="btn btn-danger-ghost btn-sm" onclick="this.parentElement.remove()">✕</button>
    `;
    document.getElementById('partidas-container').appendChild(div);
  }
  document.getElementById('btn-add-partida').addEventListener('click', agregarPartida);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Guardando...';

    const partidas = Array.from(document.querySelectorAll('.partida-row')).map(row => ({
      descripcion: row.querySelector('.p-desc').value,
      cantidad: parseFloat(row.querySelector('.p-cant').value),
      precioUnit: parseFloat(row.querySelector('.p-precio').value),
    }));

    try {
      await apiFetch('/cotizaciones', {
        method: 'POST',
        body: JSON.stringify({
          cliente: document.getElementById('cot-cliente').value,
          titulo: document.getElementById('cot-titulo').value,
          notas: document.getElementById('cot-notas').value,
          partidas
        })
      });
      showToast('✅ Cotización creada', 'success');
      modal.classList.remove('open');
      cargarDatos();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Crear Cotización';
    }
  });

  // ── Cambiar estado rápido ─────────────────────────────────
  window.cambiarEstadoCot = async (id, actual) => {
    const estados = ['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'];
    let idx = estados.indexOf(actual);
    const nuevo = estados[(idx + 1) % estados.length];
    
    if (confirm(`¿Cambiar estado a: ${nuevo.toUpperCase()}?`)) {
      try {
        await apiFetch('/cotizaciones/' + id, { method: 'PUT', body: JSON.stringify({ estado: nuevo }) });
        showToast('✅ Estado actualizado a ' + nuevo, 'success');
        cargarDatos();
      } catch(err) { showToast('Error: ' + err.message, 'error'); }
    }
  };

  cargarDatos();
});

function badgeEstadoCot(e) {
  return { borrador:'badge-muted', enviada:'badge-primary', aprobada:'badge-success', rechazada:'badge-danger', vencida:'badge-warning' }[e] || 'badge-muted';
}
