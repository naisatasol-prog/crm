// js/tickets.js — Admin
document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch, getUser, logout, showToast, requireAuth } = window.auth;
  requireAuth();
  const user = getUser();
  if (!user) return;
  document.getElementById('user-name').textContent  = user.nombre;
  document.getElementById('user-avatar').textContent = user.nombre[0].toUpperCase();
  document.getElementById('logout-btn').addEventListener('click', e => { e.preventDefault(); logout(); });

  let allTickets = [];
  let ticketActualId = null;

  async function cargarTickets() {
    try {
      const res = await apiFetch('/tickets');
      allTickets = res.tickets || [];
      filtrar();
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
        <td>${t.cliente?.empresa || 'Desconocido'}</td>
        <td>${t.titulo}<br><span style="font-size:11px;color:var(--text-secondary);text-transform:capitalize">${t.categoria}</span></td>
        <td><span class="prioridad-dot p-${t.prioridad}"></span>${t.prioridad}</td>
        <td><span class="badge ${badgeEstado(t.estado)}">${estadoLabel(t.estado)}</span></td>
        <td>${new Date(t.createdAt).toLocaleDateString('es-MX')}</td>
        <td>
          <button class="btn btn-accent btn-sm" onclick="verTicket('${t._id}')">Gestionar</button>
        </td>
      </tr>
    `).join('');
  }

  function filtrar() {
    const estado = document.getElementById('f-estado').value;
    const q = (document.getElementById('search-input').value || '').toLowerCase();
    
    let lista = estado === 'todos' ? allTickets : allTickets.filter(t => t.estado === estado);
    if (q) {
      lista = lista.filter(t => 
        t.titulo.toLowerCase().includes(q) || 
        t.folio.toLowerCase().includes(q) ||
        (t.cliente?.empresa || '').toLowerCase().includes(q)
      );
    }
    renderTabla(lista);
  }

  document.getElementById('f-estado').addEventListener('change', filtrar);
  document.getElementById('search-input').addEventListener('input', filtrar);

  // ── Ver y Gestionar ticket ──────────────────────────────
  const modalVer      = document.getElementById('modal-ver-ticket');
  const closeModalVer = document.getElementById('close-modal-ver');
  closeModalVer.addEventListener('click', () => modalVer.classList.remove('open'));
  
  window.verTicket = async (id) => {
    ticketActualId = id;
    try {
      const res = await apiFetch('/tickets/' + id);
      const t   = res.ticket;
      
      document.getElementById('admin-estado').value = t.estado;
      
      document.getElementById('ver-ticket-title').textContent = `${t.folio} — ${t.titulo}`;
      document.getElementById('ver-ticket-body').innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
          <div><span style="color:var(--text-secondary);font-size:12px;">Cliente</span><br><strong>${t.cliente?.empresa}</strong></div>
          <div><span style="color:var(--text-secondary);font-size:12px;">Contacto</span><br>${t.cliente?.email || '—'}</div>
          <div><span style="color:var(--text-secondary);font-size:12px;">Prioridad</span><br><span class="prioridad-dot p-${t.prioridad}"></span>${t.prioridad}</div>
          <div><span style="color:var(--text-secondary);font-size:12px;">Fecha</span><br>${new Date(t.createdAt).toLocaleDateString('es-MX')}</div>
        </div>
        <p style="font-size:13.5px; color:var(--text-secondary); margin-bottom:16px;">${t.descripcion}</p>
        <div class="thread" id="thread">
          ${(t.mensajes || []).map(m => `
            <div class="msg-bubble ${m.rol}">
              <div class="msg-content">${m.mensaje}</div>
              <div class="msg-meta">${m.autor} · ${new Date(m.fecha).toLocaleString('es-MX')}</div>
            </div>
          `).join('') || '<p style="text-align:center;color:var(--text-muted);font-size:13px;">Sin mensajes</p>'}
        </div>
        <form id="reply-form" style="margin-top:14px; display:flex; gap:10px;">
          <input type="text" class="form-control" id="reply-input" placeholder="Responder al cliente..." style="flex:1" required />
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
          window.verTicket(id);
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
      });
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  };

  document.getElementById('btn-actualizar-estado').addEventListener('click', async () => {
    if (!ticketActualId) return;
    const nuevoEstado = document.getElementById('admin-estado').value;
    try {
      await apiFetch('/tickets/' + ticketActualId, {
        method: 'PUT',
        body: JSON.stringify({ estado: nuevoEstado })
      });
      showToast('✅ Estado actualizado', 'success');
      cargarTickets();
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });

  await cargarTickets();
});

function badgeEstado(e) {
  return { abierto: 'badge-primary', en_proceso: 'badge-warning', resuelto: 'badge-success', cerrado: 'badge-muted' }[e] || 'badge-muted';
}
function estadoLabel(e) {
  return { abierto: 'Abierto', en_proceso: 'En Proceso', resuelto: 'Resuelto', cerrado: 'Cerrado' }[e] || e;
}
