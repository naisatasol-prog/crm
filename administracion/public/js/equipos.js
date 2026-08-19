document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('pt_admin_token');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const btnLogout = document.getElementById('logout-btn');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('pt_admin_token');
      localStorage.removeItem('pt_admin_user');
      window.location.href = 'index.html';
    });
  }

  // Mostrar datos de usuario
  const userRaw = localStorage.getItem('pt_admin_user');
  if (userRaw) {
    try {
      const user = JSON.parse(userRaw);
      if (document.getElementById('user-name')) document.getElementById('user-name').textContent = user.nombre || 'Admin';
      if (document.getElementById('user-avatar')) document.getElementById('user-avatar').textContent = (user.nombre || 'A')[0].toUpperCase();
    } catch {}
  }

  // Utilidad fetch (usa URL absoluta igual que auth.js)
  const API = 'https://simuladorrender.com/api';
  async function apiFetch(endpoint, options = {}) {
    const res = await fetch(API + endpoint, {
      ...options,
      headers: {
        'Authorization': 'Bearer ' + token,
        ...options.headers
      }
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error en la peticiÃ³n');
    return data;
  }

  // Toast
  function showToast(msg, type='success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  const gridEquipos = document.getElementById('grid-equipos');
  let equiposLocales = [];

  async function cargarEquipos() {
    try {
      const res = await apiFetch('/catalogo');
      equiposLocales = res.equipos;
      renderEquipos(equiposLocales);
    } catch (err) {
      showToast('Error al cargar equipos', 'error');
    }
  }

  function renderEquipos(lista) {
    gridEquipos.innerHTML = '';
    if (lista.length === 0) {
      gridEquipos.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding:40px 0;">No hay equipos en el catÃ¡logo. Haz clic en "+ Nuevo Equipo" para agregar.</p>';
      return;
    }
    
    lista.forEach(eq => {
      // Construir URL absoluta usando el servidor (https://simuladorrender.com)
      let imageSrc;
      if (eq.imagen_url && eq.imagen_url !== '') {
        imageSrc = 'https://simuladorrender.com/' + eq.imagen_url;
      } else {
        imageSrc = 'https://cdn-icons-png.flaticon.com/512/912/912314.png';
      }

      // Texto de puertos
      let portsText = '';
      if (eq.num_puertos > 0) {
        const capMap = { '10G': '10G', '2.5G': '2.5G', '1G': '1G', '100M': '100M', 'mixto': 'Mixto', 'offline': 'â€”' };
        portsText = `ðŸ”Œ ${eq.num_puertos} puertos Â· ${capMap[eq.capacidad_puertos] || eq.capacidad_puertos}`;
      }
      
      const card = document.createElement('div');
      card.className = 'equipo-card';
      card.innerHTML = `
        <img src="${imageSrc}" class="equipo-img" alt="${eq.nombre}" />
        <div class="equipo-title">${eq.nombre}</div>
        <div class="equipo-type">${eq.tipo}</div>
        ${portsText ? `<div class="equipo-ports">${portsText}</div>` : ''}
        <div class="equipo-actions">
          <button class="btn btn-sm btn-ghost btn-delete" data-id="${eq._id}" style="color:var(--danger); border-color:var(--danger);">Eliminar</button>
        </div>
      `;
      gridEquipos.appendChild(card);
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (confirm('Â¿Eliminar este equipo del catÃ¡logo?')) {
          const id = e.target.getAttribute('data-id');
          try {
            await apiFetch('/catalogo/' + id, { method: 'DELETE' });
            showToast('Equipo eliminado', 'success');
            cargarEquipos();
          } catch(err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  }

  // BÃºsqueda
  document.getElementById('search-equipo').addEventListener('input', (e) => {
    const txt = e.target.value.toLowerCase();
    const filtrados = equiposLocales.filter(eq => eq.nombre.toLowerCase().includes(txt) || eq.tipo.toLowerCase().includes(txt));
    renderEquipos(filtrados);
  });

  // Modal
  const modalEquipo = document.getElementById('modal-equipo');
  const portsConfig = document.getElementById('ports-config');

  // Tipos que NO tienen puertos de red
  const TIPOS_SIN_PUERTOS = new Set(['Internet', 'AP', 'Cliente']);

  function actualizarVisibilidadPuertos() {
    const tipo = document.getElementById('e-tipo').value;
    if (TIPOS_SIN_PUERTOS.has(tipo)) {
      portsConfig.style.display = 'none';
      document.getElementById('e-num-puertos').value = '0';
    } else {
      portsConfig.style.display = '';
      // Valores por defecto segÃºn tipo
      const defaults = { 'Switch': 24, 'Patch Panel': 24, 'Firewall': 4, 'Router': 4, 'Otro': 4 };
      if (!document.getElementById('e-num-puertos').value || document.getElementById('e-num-puertos').value === '0') {
        document.getElementById('e-num-puertos').value = defaults[tipo] || 4;
      }
    }
  }

  document.getElementById('btn-add-equipo').addEventListener('click', () => {
    document.getElementById('form-equipo').reset();
    actualizarVisibilidadPuertos();
    modalEquipo.classList.add('open');
  });
  document.getElementById('e-tipo').addEventListener('change', actualizarVisibilidadPuertos);
  document.getElementById('close-equipo').addEventListener('click', () => {
    modalEquipo.classList.remove('open');
  });
  document.getElementById('close-equipo-2').addEventListener('click', () => {
    modalEquipo.classList.remove('open');
  });

  document.getElementById('form-equipo').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('nombre', document.getElementById('e-nombre').value);
      formData.append('tipo', document.getElementById('e-tipo').value);
      formData.append('num_puertos', document.getElementById('e-num-puertos').value || '0');
      formData.append('capacidad_puertos', document.getElementById('e-capacidad').value);
      
      const fileInput = document.getElementById('e-imagen');
      if (fileInput.files.length > 0) {
        formData.append('imagen', fileInput.files[0]);
      }

      const res = await fetch(API + '/catalogo', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      });
      
      const data = await res.json();
      if(!data.ok) throw new Error(data.error);

      showToast('Equipo registrado exitosamente', 'success');
      modalEquipo.classList.remove('open');
      cargarEquipos();
    } catch(err) {
      showToast(err.message, 'error');
    }
  });

  cargarEquipos();
});
