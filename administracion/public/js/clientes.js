// js/clientes.js — Admin
document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch, getUser, logout, showToast, requireAuth } = window.auth;
  requireAuth();

  const user = getUser();
  if (!user) return;
  document.getElementById('user-name').textContent    = user.nombre;
  document.getElementById('user-avatar').textContent  = user.nombre[0].toUpperCase();
  document.getElementById('logout-btn').addEventListener('click', e => { e.preventDefault(); logout(); });

  let allClientes = [];

  async function cargarClientes() {
    try {
      const res = await apiFetch('/clientes');
      allClientes = res.clientes || [];
      renderTabla(allClientes);
    } catch (err) { showToast('Error cargando clientes: ' + err.message, 'error'); }
  }

  function renderTabla(clientes) {
    const tbody = document.getElementById('clientes-tbody');
    if (!clientes.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No hay clientes</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = clientes.map(c => `
      <tr>
        <td><strong>${c.empresa}</strong></td>
        <td>${c.contacto || '—'}</td>
        <td>${c.email || '—'}</td>
        <td>${c.telefono || '—'}</td>
        <td><span style="text-transform:capitalize">${c.plan}</span></td>
        <td><span class="badge ${c.estado==='activo'?'badge-success':'badge-danger'}">${c.estado}</span></td>
        <td>
          <button class="btn btn-accent btn-sm" onclick="editarCliente('${c._id}')">Editar</button>
          <button class="btn btn-primary btn-sm" onclick="crearUserCliente('${c._id}')">👤 Usuario</button>
          <button class="btn btn-sm" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;" onclick="eliminarCliente('${c._id}', '${c.empresa.replace(/'/g, "\\'")}')">🗑️ Eliminar</button>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('search-input').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const lista = allClientes.filter(c => c.empresa.toLowerCase().includes(q) || (c.contacto||'').toLowerCase().includes(q));
    renderTabla(lista);
  });

  // Modal
  const modal = document.getElementById('modal-cliente');
  const form  = document.getElementById('form-cliente');
  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => {
    form.reset();
    document.getElementById('c-id').value = '';
    document.getElementById('modal-title').textContent = 'Registrar Cliente';
    modal.classList.add('open');
  });
  document.getElementById('close-modal').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('cancel-btn').addEventListener('click', () => modal.classList.remove('open'));
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('c-id').value;
    const data = {
      empresa:  document.getElementById('c-empresa').value,
      contacto: document.getElementById('c-contacto').value,
      email:    document.getElementById('c-email').value,
      telefono: document.getElementById('c-telefono').value,
      plan:     document.getElementById('c-plan').value,
      estado:   document.getElementById('c-estado').value,
    };
    try {
      if (id) await apiFetch('/clientes/'+id, { method:'PUT', body:JSON.stringify(data) });
      else    await apiFetch('/clientes', { method:'POST', body:JSON.stringify(data) });
      showToast('✅ Cliente guardado', 'success');
      modal.classList.remove('open');
      cargarClientes();
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });

  window.editarCliente = (id) => {
    const c = allClientes.find(x => x._id === id);
    if(!c) return;
    document.getElementById('c-id').value = c._id;
    document.getElementById('c-empresa').value = c.empresa;
    document.getElementById('c-contacto').value = c.contacto || '';
    document.getElementById('c-email').value = c.email || '';
    document.getElementById('c-telefono').value = c.telefono || '';
    document.getElementById('c-plan').value = c.plan;
    document.getElementById('c-estado').value = c.estado;
    document.getElementById('modal-title').textContent = 'Editar Cliente';
    modal.classList.add('open');
  };

  window.crearUserCliente = async (id) => {
    const c = allClientes.find(x => x._id === id);
    const email = prompt(`Crear usuario para ${c.empresa}\nIngresa el correo del usuario:`, c.email || '');
    if (!email) return;
    const password = prompt(`Ingresa la contraseña temporal:`, 'cliente123');
    if (!password) return;
    
    try {
      await apiFetch('/clientes/'+id+'/usuario', {
        method:'POST',
        body: JSON.stringify({ nombre: c.contacto || 'Usuario Cliente', email, password })
      });
      showToast('✅ Usuario creado. Ya puede acceder al portal de clientes.', 'success');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  };

  window.eliminarCliente = async (id, empresa) => {
    if (!confirm(`⚠️ ¿Estás SEGURO de eliminar al cliente "${empresa}"?\n\nSe eliminarán en cascada:\n• Todos sus Sitios (sucursales)\n• Todas las Áreas (IDF/MDF)\n• Todos los Equipos en esas áreas\n• Los usuarios de acceso del cliente\n\nEsta acción es IRREVERSIBLE.`)) return;
    try {
      await apiFetch('/clientes/' + id, { method: 'DELETE' });
      showToast('✅ Cliente y toda su topología eliminados', 'success');
      cargarClientes();
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  };

  cargarClientes();
});
