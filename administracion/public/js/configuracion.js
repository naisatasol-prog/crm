// js/configuracion.js
document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch, getUser, logout, showToast, requireAuth } = window.auth;
  requireAuth();

  const user = getUser();
  if (!user) return;
  document.getElementById('user-name').textContent = user.nombre;
  document.getElementById('user-avatar').textContent = user.nombre[0].toUpperCase();
  document.getElementById('logout-btn').addEventListener('click', e => { e.preventDefault(); logout(); });

  // â”€â”€ Estado global â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let tipoFiltro   = 'Switch';
  let arbolCompleto = null;
  let equipos      = [];
  let catalogoVlans = [];   // [{_id, id_vlan, nombre, color}]
  let currentEqIndex   = null;
  let currentPortIndex = null;
  let modoVlanActual   = 'ninguno';
  let connTipoActual   = 'libre';

  // â”€â”€ DOM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selCliente    = document.getElementById('sel-cliente');
  const selSitio      = document.getElementById('sel-sitio');
  const tabs          = document.querySelectorAll('.config-tab');
  const container     = document.getElementById('equipos-container');
  const panelEquipos  = document.getElementById('panel-equipos');
  const panelVlans    = document.getElementById('panel-vlans');
  const filterBar     = document.getElementById('filter-bar');
  const modalPort     = document.getElementById('modal-port-config');
  const modalVlan     = document.getElementById('modal-vlan');

  // â”€â”€ CatÃ¡logo de VLANs (carga inicial) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function cargarVlans() {
    try {
      const res = await apiFetch('/topologia/vlans');
      catalogoVlans = res.vlans || [];
      renderVlansTable();
    } catch(e) {
      console.warn('No se pudo cargar VLANs:', e);
    }
  }

  // â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  tabs.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tipo = tab.getAttribute('data-type');

      if (tipo === '__vlans__') {
        panelEquipos.style.display = 'none';
        filterBar.style.display = 'none';
        panelVlans.style.display = 'block';
        renderVlansTable();
      } else {
        panelEquipos.style.display = 'block';
        filterBar.style.display = 'flex';
        panelVlans.style.display = 'none';
        tipoFiltro = tipo;
        cargarEquiposFiltro();
      }
    });
  });

  // â”€â”€ JerarquÃ­a Clientes/Sitios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function cargarJerarquia() {
    try {
      const resC = await apiFetch('/clientes');
      const clientes = resC.clientes || [];
      selCliente.innerHTML = '<option value="">-- Seleccione un Cliente --</option>';
      clientes.forEach(c => {
        selCliente.innerHTML += `<option value="${c._id}">${c.empresa}</option>`;
      });

      selCliente.addEventListener('change', async () => {
        const cId = selCliente.value;
        if (!cId) {
          selSitio.innerHTML = '<option value="">Primero seleccione un cliente</option>';
          container.innerHTML = mensajeVacio();
          return;
        }
        selSitio.innerHTML = '<option value="">Cargando sitios...</option>';
        try {
          const res = await apiFetch('/topologia/arbol/' + cId);
          arbolCompleto = res.arbol;
          selSitio.innerHTML = '<option value="">-- Seleccione un Sitio --</option>';
          if (arbolCompleto.sitios) {
            arbolCompleto.sitios.forEach(s => {
              selSitio.innerHTML += `<option value="${s._id}">${s.nombre}</option>`;
            });
          }
        } catch(e) {
          showToast('Error cargando sitios', 'error');
        }
      });

      selSitio.addEventListener('change', () => cargarEquiposFiltro());
    } catch(err) {
      showToast('Error de red', 'error');
    }
  }

  // â”€â”€ Carga y Render de Equipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function mensajeVacio(texto) {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:var(--text-secondary);">
        <div style="font-size:52px;opacity:.25;margin-bottom:16px;">âš™ï¸</div>
        <div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
          ${texto || 'Seleccione una OrganizaciÃ³n y un Sitio'}
        </div>
        <div style="font-size:13px;max-width:360px;text-align:center;line-height:1.7;">
          ${texto ? '' : 'Usa los filtros de arriba para elegir el cliente y su sitio.<br>Luego verÃ¡s los equipos del tipo seleccionado en la pestaÃ±a activa.'}
        </div>
      </div>`;
  }

  function generarPuertosDefault(num = 24) {
    const p = [];
    for (let i = 1; i <= num; i++) {
      p.push({ numero: i, nombre: `GE0/0/${i}`, capacidad: 'offline', uso: 'ninguno',
               conexion_tipo: 'libre', conexion_label: '',
               vlan_modo: 'ninguno', vlan_access: null, vlan_trunk: [] });
    }
    return p;
  }

  async function cargarEquiposFiltro() {
    const sitioId = selSitio.value;
    if (!sitioId) { container.innerHTML = mensajeVacio('Por favor, seleccione un sitio.'); return; }
    container.innerHTML = `<p style="text-align:center;color:var(--text-secondary);padding:40px;">Cargando equipos...</p>`;
    equipos = [];
    const sitio = arbolCompleto.sitios.find(s => s._id === sitioId);
    if (!sitio || !sitio.areas) return renderEquipos();
    const allEquipos = [];
    for (const area of sitio.areas) {
      try {
        const reqEq = await apiFetch('/topologia/equipos/' + area._id);
        if (reqEq.equipos) allEquipos.push(...reqEq.equipos.filter(e => e.tipo === tipoFiltro));
      } catch(e) {}
    }
    equipos = allEquipos;
    renderEquipos();
  }

  function vlanLabel(id_vlan) {
    const v = catalogoVlans.find(v => v.id_vlan === id_vlan);
    return v ? `${v.id_vlan} â€” ${v.nombre}` : `VLAN ${id_vlan}`;
  }
  function vlanColor(id_vlan) {
    const v = catalogoVlans.find(v => v.id_vlan === id_vlan);
    return v ? v.color : '#7c3aed';
  }

  function renderEquipos() {
    if (equipos.length === 0) {
      container.innerHTML = mensajeVacio(`No hay equipos de tipo "${tipoFiltro}" en el sitio seleccionado.`);
      return;
    }
    let html = '';
    equipos.forEach((eq, index) => {
      if (!eq.puertos || eq.puertos.length === 0) eq.puertos = generarPuertosDefault(24);

      const portsHtml = eq.puertos.map((p, pIndex) => {
        if (eq.tipo === 'Patch Panel') {
          // Renderizado especial para Patch Panel
          let tooltip = `Puerto ${p.numero}`;
          if (p.conexion_label) tooltip += `\nFrente (Red): ${p.conexion_label}`;
          if (p.conexion_posterior) tooltip += `\nAtrÃ¡s (Campo): ${p.conexion_posterior}`;
          
          return `
            <div class="port-item state-offline" onclick="window.abrirModalPuerto(${index}, ${pIndex})" title="${tooltip}">
              <div class="port-number">${p.numero}</div>
              <div class="port-icon" style="background:#cbd5e1; height:34px;">
                <span class="port-label" style="font-size:8px;">PP</span>
              </div>
              ${p.conexion_label ? '<div style="font-size:8px;line-height:1;margin-top:2px;" title="Frente">ðŸ”—</div>' : ''}
              ${p.conexion_posterior ? '<div style="font-size:8px;line-height:1;margin-top:1px;" title="AtrÃ¡s">ðŸ–¥ï¸</div>' : ''}
            </div>`;
        } else {
          // Renderizado normal (Activo)
          let pClass = 'state-offline';
          if (p.capacidad === '10G' || p.capacidad === '2.5G') pClass = 'state-fast';
          else if (p.capacidad === '1G') pClass = 'state-1000m';
          else if (p.capacidad === '100M') pClass = 'state-100m';

          // Label velocidad
          const capLabel = p.capacidad === 'offline' ? 'GE' : p.capacidad;

          // Badge VLAN
          let vlanBadge = '';
          if (p.vlan_modo === 'access' && p.vlan_access) {
            const col = vlanColor(p.vlan_access);
            vlanBadge = `<div class="port-vlan-badge badge-access" style="background:${col};" title="${vlanLabel(p.vlan_access)}">V${p.vlan_access}</div>`;
          } else if (p.vlan_modo === 'trunk' && p.vlan_trunk && p.vlan_trunk.length > 0) {
            vlanBadge = `<div class="port-vlan-badge badge-trunk" title="Trunk: ${p.vlan_trunk.map(v => vlanLabel(v)).join(', ')}">TÂ·${p.vlan_trunk.length}</div>`;
          }

          // Ãcono de conexiÃ³n
          let connIcon = '';
          if (p.conexion_tipo === 'equipo_red') connIcon = `<div class="port-conn-icon" title="${p.conexion_label || 'Equipo de Red'}">ðŸ”—</div>`;
          else if (p.conexion_tipo === 'dispositivo_final') connIcon = `<div class="port-conn-icon" title="${p.conexion_label || 'Dispositivo Final'}">ðŸ–¥ï¸</div>`;

          // Tooltip completo
          let tooltip = `Puerto ${p.numero}`;
          if (p.conexion_label) tooltip += ` â†’ ${p.conexion_label}`;
          if (p.vlan_modo === 'access') tooltip += ` | Access: ${vlanLabel(p.vlan_access)}`;
          else if (p.vlan_modo === 'trunk') tooltip += ` | Trunk: ${(p.vlan_trunk || []).map(v => vlanLabel(v)).join(', ')}`;

          return `
            <div class="port-item ${pClass}" onclick="window.abrirModalPuerto(${index}, ${pIndex})" title="${tooltip}">
              <div class="port-number">${p.numero}</div>
              <div class="port-icon">
                <span class="port-label">${capLabel}</span>
              </div>
              ${vlanBadge}
              ${connIcon}
            </div>`;
        }
      }).join('');

      html += `
        <div class="equipo-card" data-index="${index}">
          <div class="equipo-header">
            <div class="equipo-info">
              <img src="${eq.imagen_url ? 'https://simuladorrender.com/'+eq.imagen_url : 'https://cdn-icons-png.flaticon.com/512/912/912314.png'}" class="equipo-img" crossorigin="anonymous">
              <div>
                <div class="equipo-name">${eq.nombre}</div>
                <div class="equipo-type">${eq.tipo}</div>
              </div>
            </div>
          </div>
          <div class="legend">
            <div class="legend-item"><div class="legend-color bg-fast"></div> 10G/2.5G</div>
            <div class="legend-item"><div class="legend-color bg-1000m"></div> 1G</div>
            <div class="legend-item"><div class="legend-color bg-100m"></div> 100M</div>
            <div class="legend-item"><div class="legend-color bg-offline"></div> Desconectado</div>
            <div class="legend-item"><span style="font-size:11px;background:#7c3aed;color:#fff;padding:1px 5px;border-radius:3px;font-weight:700;">V#</span> Access VLAN</div>
            <div class="legend-item"><span style="font-size:11px;background:#ea580c;color:#fff;padding:1px 5px;border-radius:3px;font-weight:700;">TÂ·N</span> Trunk (N VLANs)</div>
          </div>
          <div class="ports-grid" style="margin-top:15px;">${portsHtml}</div>
        </div>`;
    });
    container.innerHTML = html;
  }

  // â”€â”€ Modal de Puerto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function buildVlanUI() {
    // Select de Access
    const selAccess = document.getElementById('port-vlan-access');
    selAccess.innerHTML = '<option value="">-- Seleccionar VLAN --</option>';
    catalogoVlans.forEach(v => {
      selAccess.innerHTML += `<option value="${v.id_vlan}">${v.id_vlan} â€” ${v.nombre}</option>`;
    });

    // Checkboxes de Trunk
    const grid = document.getElementById('vlan-trunk-grid');
    grid.innerHTML = '';
    if (catalogoVlans.length === 0) {
      grid.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:8px;">No hay VLANs en el catÃ¡logo. AgrÃ©galas en la tab ðŸ·ï¸ VLANs.</div>';
      return;
    }
    catalogoVlans.forEach(v => {
      const el = document.createElement('label');
      el.className = 'vlan-check-item';
      el.setAttribute('data-vlan-id', v.id_vlan);
      el.innerHTML = `
        <input type="checkbox" value="${v.id_vlan}">
        <span style="width:10px;height:10px;border-radius:2px;background:${v.color};display:inline-block;"></span>
        ${v.id_vlan} â€” ${v.nombre}`;
      el.querySelector('input').addEventListener('change', e => {
        el.classList.toggle('checked', e.target.checked);
      });
      grid.appendChild(el);
    });
  }

  function setVlanMode(modo) {
    modoVlanActual = modo;
    document.querySelectorAll('.vlan-mode-btn').forEach(b => {
      b.classList.toggle('selected', b.getAttribute('data-mode') === modo);
    });
    document.getElementById('vlan-access-wrap').style.display = modo === 'access' ? 'block' : 'none';
    document.getElementById('vlan-trunk-wrap').style.display  = modo === 'trunk'  ? 'block' : 'none';
  }

  function setConnTipo(tipo) {
    connTipoActual = tipo;
    document.querySelectorAll('.conn-opt').forEach(o => {
      o.classList.toggle('selected', o.getAttribute('data-val') === tipo);
    });
    const showLabel = tipo === 'equipo_red' || tipo === 'dispositivo_final';
    document.getElementById('conn-label-wrap').style.display = showLabel ? 'block' : 'none';
    if (!showLabel) document.getElementById('port-conn-label').value = '';
    // Update placeholder
    if (tipo === 'equipo_red') document.getElementById('port-conn-label').placeholder = 'Ej: SW-Core-01, Firewall-FW1â€¦';
    if (tipo === 'dispositivo_final') document.getElementById('port-conn-label').placeholder = 'Ej: Server Dell R740, Impresora HPâ€¦';
  }

  // Listeners botones de modo VLAN
  document.querySelectorAll('.vlan-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setVlanMode(btn.getAttribute('data-mode')));
  });

  // Listeners opciones de conexiÃ³n
  document.querySelectorAll('.conn-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.getAttribute('data-val');
      if (val === 'patch_panel') return; // deshabilitado
      setConnTipo(val);
    });
  });

  window.abrirModalPuerto = (eqIndex, portIndex) => {
    currentEqIndex   = eqIndex;
    currentPortIndex = portIndex;
    const eq = equipos[eqIndex];
    const p = eq.puertos[portIndex];

    document.getElementById('port-modal-title').textContent = `Configurar Puerto ${p.numero} â€” ${eq.nombre}`;
    
    const isPP = eq.tipo === 'Patch Panel';
    document.getElementById('modal-section-capacidad').style.display = isPP ? 'none' : 'block';
    document.getElementById('modal-section-uso').style.display = isPP ? 'none' : 'block';
    document.getElementById('modal-section-destino').style.display = isPP ? 'none' : 'block';
    document.getElementById('modal-section-vlans').style.display = isPP ? 'none' : 'block';
    document.getElementById('modal-section-patch-panel').style.display = isPP ? 'block' : 'none';

    if (isPP) {
      document.getElementById('pp-conn-front').value = p.conexion_label || '';
      document.getElementById('pp-conn-back').value = p.conexion_posterior || '';
    } else {
      document.getElementById('port-capacidad').value = p.capacidad || 'offline';
      document.getElementById('port-uso').value       = p.uso       || 'ninguno';

      // ConexiÃ³n
      setConnTipo(p.conexion_tipo || 'libre');
      document.getElementById('port-conn-label').value = p.conexion_label || '';

      // VLANs
      buildVlanUI();
      setVlanMode(p.vlan_modo || 'ninguno');

      // Restaurar access
      if (p.vlan_access) document.getElementById('port-vlan-access').value = p.vlan_access;

      // Restaurar trunk checkboxes
      const trunkIds = p.vlan_trunk || [];
      document.querySelectorAll('#vlan-trunk-grid .vlan-check-item').forEach(item => {
        const vid = parseInt(item.getAttribute('data-vlan-id'));
        const checked = trunkIds.includes(vid);
        item.querySelector('input').checked = checked;
        item.classList.toggle('checked', checked);
      });
    }

    modalPort.classList.add('open');
  };

  document.getElementById('btn-close-port-modal').addEventListener('click', () => modalPort.classList.remove('open'));

  document.getElementById('btn-save-port').addEventListener('click', () => {
    if (currentEqIndex === null || currentPortIndex === null) return;
    const eq = equipos[currentEqIndex];
    const p = eq.puertos[currentPortIndex];

    if (eq.tipo === 'Patch Panel') {
      p.conexion_tipo = 'patch_panel';
      p.conexion_label = document.getElementById('pp-conn-front').value.trim();
      p.conexion_posterior = document.getElementById('pp-conn-back').value.trim();
      p.capacidad = 'offline';
      p.uso = 'ninguno';
      p.vlan_modo = 'ninguno';
      p.vlan_access = null;
      p.vlan_trunk = [];
    } else {
      p.capacidad      = document.getElementById('port-capacidad').value;
      p.uso            = document.getElementById('port-uso').value;
      p.conexion_tipo  = connTipoActual;
      p.conexion_label = document.getElementById('port-conn-label').value.trim();
      p.vlan_modo      = modoVlanActual;

      if (modoVlanActual === 'access') {
        const v = document.getElementById('port-vlan-access').value;
        p.vlan_access = v ? parseInt(v) : null;
        p.vlan_trunk  = [];
      } else if (modoVlanActual === 'trunk') {
        p.vlan_trunk = [];
        document.querySelectorAll('#vlan-trunk-grid .vlan-check-item input:checked').forEach(chk => {
          p.vlan_trunk.push(parseInt(chk.value));
        });
        p.vlan_access = null;
      } else {
        p.vlan_access = null;
        p.vlan_trunk  = [];
      }
    }

    modalPort.classList.remove('open');
    renderEquipos();
  });

  // â”€â”€ Guardar en BD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  document.getElementById('btn-save-all').addEventListener('click', async () => {
    if (equipos.length === 0) return showToast('No hay equipos para guardar', 'info');
    try {
      const token = localStorage.getItem('pt_admin_token');
      let count = 0;
      for (const eq of equipos) {
        await fetch(`https://simuladorrender.com/api/topologia/equipos/${eq._id}/puertos`, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ puertos: eq.puertos })
        });
        count++;
      }
      showToast(`âœ… Se guardaron ${count} equipos correctamente`, 'success');
    } catch(err) {
      showToast('Error al guardar: ' + err.message, 'error');
    }
  });

  // â”€â”€ Panel de VLANs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderVlansTable() {
    const list = document.getElementById('vlans-list');
    if (catalogoVlans.length === 0) {
      list.innerHTML = `
        <div style="padding:50px;text-align:center;color:var(--text-secondary);">
          <div style="font-size:40px;opacity:.2;margin-bottom:12px;">ðŸ·ï¸</div>
          <div style="font-weight:600;margin-bottom:6px;">No hay VLANs en el catÃ¡logo</div>
          <div style="font-size:13px;">Haz clic en "+ Nueva VLAN" para crear la primera.</div>
        </div>`;
      return;
    }
    list.innerHTML = catalogoVlans.map(v => `
      <div class="vlan-row">
        <div class="vlan-chip" style="background:${v.color};">${v.id_vlan}</div>
        <div class="vlan-id">${v.id_vlan}</div>
        <div class="vlan-name">
          <div style="font-weight:600;">${v.nombre}</div>
          ${v.notas ? `<div style="font-size:12px;color:var(--text-secondary);">${v.notas}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;margin-left:auto;">
          <button class="btn btn-ghost btn-sm" onclick="window.editarVlan('${v._id}')">âœï¸ Editar</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="window.eliminarVlan('${v._id}', ${v.id_vlan})">ðŸ—‘ï¸</button>
        </div>
      </div>`).join('');
  }

  // Abrir modal para nueva VLAN
  document.getElementById('btn-nueva-vlan').addEventListener('click', () => {
    document.getElementById('vlan-modal-title').textContent = 'Nueva VLAN';
    document.getElementById('vlan-edit-id').value = '';
    document.getElementById('vlan-id-input').value = '';
    document.getElementById('vlan-nombre-input').value = '';
    document.getElementById('vlan-color-input').value = '#3b82f6';
    document.getElementById('vlan-notas-input').value = '';
    modalVlan.classList.add('open');
  });

  // Editar VLAN
  window.editarVlan = (id) => {
    const v = catalogoVlans.find(v => v._id === id);
    if (!v) return;
    document.getElementById('vlan-modal-title').textContent = `Editar VLAN ${v.id_vlan}`;
    document.getElementById('vlan-edit-id').value      = v._id;
    document.getElementById('vlan-id-input').value     = v.id_vlan;
    document.getElementById('vlan-nombre-input').value = v.nombre;
    document.getElementById('vlan-color-input').value  = v.color;
    document.getElementById('vlan-notas-input').value  = v.notas || '';
    modalVlan.classList.add('open');
  };

  // Eliminar VLAN
  window.eliminarVlan = async (id, idVlan) => {
    if (!confirm(`Â¿Eliminar VLAN ${idVlan}? Esta acciÃ³n no se puede deshacer.`)) return;
    try {
      await apiFetch('/topologia/vlans/' + id, { method: 'DELETE' });
      catalogoVlans = catalogoVlans.filter(v => v._id !== id);
      renderVlansTable();
      showToast(`VLAN ${idVlan} eliminada`, 'success');
    } catch(e) { showToast('Error al eliminar VLAN', 'error'); }
  };

  document.getElementById('btn-close-vlan-modal').addEventListener('click', () => modalVlan.classList.remove('open'));

  // Presets de color
  document.querySelectorAll('.color-preset').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('vlan-color-input').value = el.getAttribute('data-color');
    });
  });

  // Guardar VLAN
  document.getElementById('btn-save-vlan').addEventListener('click', async () => {
    const editId = document.getElementById('vlan-edit-id').value;
    const id_vlan = parseInt(document.getElementById('vlan-id-input').value);
    const nombre  = document.getElementById('vlan-nombre-input').value.trim();
    const color   = document.getElementById('vlan-color-input').value;
    const notas   = document.getElementById('vlan-notas-input').value.trim();

    if (!id_vlan || !nombre) return showToast('El ID y el nombre son obligatorios', 'error');
    if (id_vlan < 1 || id_vlan > 4094) return showToast('El ID debe estar entre 1 y 4094', 'error');

    try {
      if (editId) {
        const res = await apiFetch('/topologia/vlans/' + editId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_vlan, nombre, color, notas })
        });
        const idx = catalogoVlans.findIndex(v => v._id === editId);
        if (idx !== -1) catalogoVlans[idx] = res.vlan;
        showToast(`âœ… VLAN ${id_vlan} actualizada`, 'success');
      } else {
        const res = await apiFetch('/topologia/vlans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_vlan, nombre, color, notas })
        });
        catalogoVlans.push(res.vlan);
        catalogoVlans.sort((a,b) => a.id_vlan - b.id_vlan);
        showToast(`âœ… VLAN ${id_vlan} creada`, 'success');
      }
      modalVlan.classList.remove('open');
      renderVlansTable();
    } catch(e) {
      showToast('Error: ' + (e.message || 'ID de VLAN duplicado'), 'error');
    }
  });

  // â”€â”€ InicializaciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await cargarVlans();
  cargarJerarquia();
});
