// js/tickets.js — Portal Clientes
document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch, getUser, logout, showToast, requireAuth } = window.auth;
  requireAuth();
  const user = getUser();
  document.getElementById('user-name').textContent = user.nombre;
  document.getElementById('user-avatar').textContent = user.nombre[0].toUpperCase();
  document.getElementById('empresa-nombre').textContent = user.cliente?.empresa || (user.rol === 'admin' ? 'Vista Admin' : 'Mi Empresa');
  document.getElementById('logout-btn').addEventListener('click', e => { e.preventDefault(); logout(); });

  let allTickets = [];
  let filtroActual = 'todos';

  // ── Cargar tickets ──────────────────────────────────────
  async function cargarTickets() {
    try {
      const res = await apiFetch('/tickets');
      allTickets = res.tickets || [];
      renderTabla(allTickets);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  function renderTabla(tickets) {
    const tbody = document.getElementById('tickets-tbody');
    if (!tickets.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🎫</div><div class="empty-text">No hay tickets</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = tickets.map(t => `
      <tr>
        <td><strong style="color:var(--accent)">${t.folio}</strong></td>
        <td>${t.titulo}</td>
        <td><span style="text-transform:capitalize">${t.categoria}</span></td>
        <td><span class="prioridad-dot p-${t.prioridad}"></span>${t.prioridad}</td>
        <td><span class="badge ${badgeEstado(t.estado)}">${estadoLabel(t.estado)}</span></td>
        <td>${new Date(t.createdAt).toLocaleDateString('es-MX')}</td>
        <td>
          <button class="btn btn-accent btn-sm" onclick="verTicket('${t._id}')">Ver</button>
        </td>
      </tr>
    `).join('');
  }

  function filtrar() {
    const q = (document.getElementById('search-input').value || '').toLowerCase();
    let lista = filtroActual === 'todos' ? allTickets : allTickets.filter(t => t.estado === filtroActual);
    if (q) lista = lista.filter(t => t.titulo.toLowerCase().includes(q) || t.folio.toLowerCase().includes(q));
    renderTabla(lista);
  }

  // Filtros
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroActual = btn.dataset.filter;
      filtrar();
    });
  });
  document.getElementById('search-input').addEventListener('input', filtrar);

  // ── Modal nuevo ticket ──────────────────────────────────
  const modalTicket   = document.getElementById('modal-ticket');
  const btnNuevo      = document.getElementById('btn-nuevo-ticket');
  const closeModal    = document.getElementById('close-modal-ticket');
  const cancelTicket  = document.getElementById('cancel-ticket');
  const formTicket    = document.getElementById('form-ticket');

  btnNuevo.addEventListener('click',   () => modalTicket.classList.add('open'));
  closeModal.addEventListener('click', () => modalTicket.classList.remove('open'));
  cancelTicket.addEventListener('click', () => modalTicket.classList.remove('open'));
  modalTicket.addEventListener('click', e => { if (e.target === modalTicket) modalTicket.classList.remove('open'); });

  formTicket.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = formTicket.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      await apiFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          titulo:      document.getElementById('t-titulo').value,
          categoria:   document.getElementById('t-categoria').value,
          prioridad:   document.getElementById('t-prioridad').value,
          descripcion: document.getElementById('t-descripcion').value,
        }),
      });
      showToast('✅ Ticket creado correctamente', 'success');
      modalTicket.classList.remove('open');
      formTicket.reset();
      await cargarTickets();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Enviar Ticket';
    }
  });

  // ── Ver ticket ──────────────────────────────────────────
  const modalVer      = document.getElementById('modal-ver-ticket');
  const closeModalVer = document.getElementById('close-modal-ver');
  closeModalVer.addEventListener('click', () => modalVer.classList.remove('open'));
  modalVer.addEventListener('click', e => { if (e.target === modalVer) modalVer.classList.remove('open'); });

  window.verTicket = async (id) => {
    try {
      const res = await apiFetch('/tickets/' + id);
      const t   = res.ticket;
      document.getElementById('ver-ticket-title').textContent = `${t.folio} — ${t.titulo}`;
      document.getElementById('ver-ticket-body').innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
          <div><span style="color:var(--text-secondary);font-size:12px;">Estado</span><br><span class="badge ${badgeEstado(t.estado)}">${estadoLabel(t.estado)}</span></div>
          <div><span style="color:var(--text-secondary);font-size:12px;">Prioridad</span><br><span class="prioridad-dot p-${t.prioridad}"></span>${t.prioridad}</div>
          <div><span style="color:var(--text-secondary);font-size:12px;">Categoría</span><br>${t.categoria}</div>
          <div><span style="color:var(--text-secondary);font-size:12px;">Creado</span><br>${new Date(t.createdAt).toLocaleDateString('es-MX')}</div>
        </div>
        <p style="font-size:13.5px; color:var(--text-secondary); margin-bottom:16px;">${t.descripcion}</p>
        <div class="thread" id="thread">
          ${(t.mensajes || []).map(m => `
            <div class="msg-bubble ${m.rol}">
              <div class="msg-content">${m.mensaje}</div>
              <div class="msg-meta">${m.autor} · ${new Date(m.fecha).toLocaleString('es-MX')}</div>
            </div>
          `).join('') || '<p style="text-align:center;color:var(--text-muted);font-size:13px;">Sin mensajes aún</p>'}
        </div>
        <form id="reply-form" style="margin-top:14px; display:flex; gap:10px;">
          <input type="text" class="form-control" id="reply-input" placeholder="Escribe un mensaje..." style="flex:1" />
          <button type="submit" class="btn btn-primary btn-sm">Enviar</button>
        </form>
      `;
      modalVer.classList.add('open');

      document.getElementById('reply-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('reply-input').value.trim();
        if (!msg) return;
        try {
          await apiFetch('/tickets/' + id + '/mensaje', { method: 'POST', body: JSON.stringify({ mensaje: msg }) });
          document.getElementById('reply-input').value = '';
          window.verTicket(id);
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
      });
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  };

  await cargarTickets();
});

function badgeEstado(e) {
  return { abierto: 'badge-primary', en_proceso: 'badge-warning', resuelto: 'badge-success', cerrado: 'badge-muted' }[e] || 'badge-muted';
}
function estadoLabel(e) {
  return { abierto: 'Abierto', en_proceso: 'En Proceso', resuelto: 'Resuelto', cerrado: 'Cerrado' }[e] || e;
}
