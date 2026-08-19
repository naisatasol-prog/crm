// js/planos_topo.js â€” LÃ³gica de Planos Interactivos Integrada en TopologÃ­a
(() => {
  const { apiFetch, getToken, showToast } = window.auth;

  // DOM Elements
  const layout = document.querySelector('.topo-layout');
  const treePanel = document.getElementById('tree-panel');
  const detailPanel = document.getElementById('detail-panel');
  const planoPanel = document.getElementById('plano-panel');
  const planoAreaNombre = document.getElementById('plano-area-nombre');
  
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const emptyStatePlano = document.getElementById('empty-state-plano');
  const planoContainer = document.getElementById('plano-container');
  const planoImg = document.getElementById('plano-img');
  const planoCanvas = document.getElementById('plano-canvas');
  const marcadoresLayer = document.getElementById('marcadores-layer');
  const drawer = document.getElementById('marcador-drawer');

  // Modals
  const modalPlano = document.getElementById('modal-plano');
  const formPlano = document.getElementById('form-plano');
  const modalMarcador = document.getElementById('modal-marcador');
  const formMarcador = document.getElementById('form-marcador');

  let currentAreaId = null;
  let currentSitioId = null;
  let currentPlanoId = null;
  let planosList = [];
  let marcadores = [];
  
  let currentZoom = 1;
  let panX = 0, panY = 0;
  let isPanning = false;

  // â”€â”€ Smart Formatters for IP / MAC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function initNetworkFieldFormatters() {
    // â”€â”€ MAC: auto-insertar : cada 2 caracteres hex â”€â”€â”€â”€â”€
    const macInput = document.getElementById('m-mac');
    if (macInput) {
      macInput.addEventListener('input', function () {
        let val = this.value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        if (val.length > 12) val = val.slice(0, 12);
        // Insertar dos puntos cada 2 chars
        this.value = val.replace(/(.{2})(?=.)/g, '$1:');
      });
    }

    // â”€â”€ IP: auto-insertar punto despuÃ©s de cada octeto â”€
    const ipInput = document.getElementById('m-ip');
    if (ipInput) {
      ipInput.addEventListener('input', function (e) {
        // Permitir solo dÃ­gitos y puntos
        let val = this.value.replace(/[^0-9.]/g, '');
        // Limitar cada octeto a 3 dÃ­gitos y mÃ¡x 4 octetos
        const partes = val.split('.');
        const limpias = partes.slice(0, 4).map(p => p.slice(0, 3).replace(/^0+(\d)/, '$1'));
        // Si la Ãºltima parte escribiÃ³ 3 dÃ­gitos y aÃºn quedan octetos, insertar punto
        let resultado = limpias.join('.');
        this.value = resultado;

        // Auto-detectar subnet y gateway cuando IP parezca completa
        const octetos = resultado.split('.');
        if (octetos.length === 4 && octetos[3].length > 0) {
          autoDetectSubnetGateway(resultado);
        }
      });

      // TambiÃ©n detectar al perder foco
      ipInput.addEventListener('blur', function () {
        autoDetectSubnetGateway(this.value);
      });
    }
  }

  function autoDetectSubnetGateway(ip) {
    const subnetInput  = document.getElementById('m-subnet');
    const gatewayInput = document.getElementById('m-gateway');
    if (!subnetInput || !gatewayInput) return;
    // No sobreescribir si ya tienen datos ingresados manualmente
    const octetos = ip.trim().split('.');
    if (octetos.length !== 4 || octetos.some(o => o === '' || isNaN(Number(o)))) return;
    const [a, b, c, d] = octetos.map(Number);
    let subnet = '', gateway = '';

    // Rangos privados comunes
    if (a === 10) {
      subnet  = '255.0.0.0';
      gateway = `10.${b}.${c}.1`;
    } else if (a === 172 && b >= 16 && b <= 31) {
      subnet  = '255.255.0.0';
      gateway = `172.${b}.0.1`;
    } else if (a === 192 && b === 168) {
      subnet  = '255.255.255.0';
      gateway = `192.168.${c}.1`;
    } else if (a >= 1 && a <= 126) {
      subnet  = '255.0.0.0';
      gateway = `${a}.0.0.1`;
    } else if (a >= 128 && a <= 191) {
      subnet  = '255.255.0.0';
      gateway = `${a}.${b}.0.1`;
    } else if (a >= 192 && a <= 223) {
      subnet  = '255.255.255.0';
      gateway = `${a}.${b}.${c}.1`;
    }

    if (subnet  && !subnetInput.value)  subnetInput.value  = subnet;
    if (gateway && !gatewayInput.value) gatewayInput.value = gateway;
  }

  // Inicializar formatters al cargar
  initNetworkFieldFormatters();

  // â”€â”€ INICIAR MODO PLANO â”€â”€
  window.iniciarModoPlano = (areaId, sitioId, nombre) => {
    currentAreaId = areaId;
    currentSitioId = sitioId;
    planoAreaNombre.textContent = nombre;

    layout.classList.add('compact-sidebar-mode');
    treePanel.classList.add('compact-sidebar');
    detailPanel.style.display = 'none';
    planoPanel.style.display = 'flex';

    cargarPlanosDelArea();
  };

  document.getElementById('btn-toggle-sidebar').addEventListener('click', (e) => {
    e.stopPropagation();
    if (layout.classList.contains('compact-sidebar-mode')) {
      layout.classList.remove('compact-sidebar-mode');
      treePanel.classList.remove('compact-sidebar');
    } else {
      layout.classList.add('compact-sidebar-mode');
      treePanel.classList.add('compact-sidebar');
    }
  });

  document.getElementById('btn-cerrar-plano').addEventListener('click', () => {
    layout.classList.remove('compact-sidebar-mode');
    treePanel.classList.remove('compact-sidebar');
    planoPanel.style.display = 'none';
    detailPanel.style.display = 'block';
    drawer.classList.remove('open');
  });

  document.getElementById('drawer-close').addEventListener('click', () => {
    drawer.classList.remove('open');
  });

  // â”€â”€ CARGAR Y RENDERIZAR PLANOS â”€â”€
  async function cargarPlanosDelArea() {
    try {
      const res = await apiFetch(`/planos/area/${currentAreaId}`);
      planosList = res.planos || [];
      if (planosList.length > 0) {
        seleccionarPlano(planosList[0]._id); // Selecciona el primero por defecto
      } else {
        emptyStatePlano.style.display = 'flex';
        planoContainer.style.display = 'none';
        marcadoresLayer.innerHTML = '';
        currentPlanoId = null;
      }
    } catch(err) { showToast('Error cargando planos: ' + err.message, 'error'); }
  }

  function seleccionarPlano(id) {
    currentPlanoId = id;
    const plano = planosList.find(p => p._id === id);
    if (!plano) return;
    
    emptyStatePlano.style.display = 'none';
    planoContainer.style.display = 'inline-block';
    
    currentZoom = 1; panX = 0; panY = 0;
    updateTransform();

    const url = 'https://simuladorrender.com/' + plano.imagen_url;
    if (url.toLowerCase().endsWith('.pdf')) {
      planoImg.style.display = 'none';
      planoCanvas.style.display = 'block';
      const renderPDF = async () => {
        try {
          const pdf = await pdfjsLib.getDocument(url).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          planoCanvas.width = viewport.width;
          planoCanvas.height = viewport.height;
          planoCanvas.style.width = (viewport.width / 2) + 'px';
          const ctx = planoCanvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          cargarMarcadores();
        } catch (e) {
          showToast('Error cargando PDF', 'error');
        }
      };
      renderPDF();
    } else {
      planoCanvas.style.display = 'none';
      planoImg.style.display = 'block';
      planoImg.src = url;
      planoImg.onload = () => cargarMarcadores();
    }
  }

  // â”€â”€ SUBIR PLANO â”€â”€
  document.getElementById('btn-add-plano').addEventListener('click', () => {
    formPlano.reset();
    modalPlano.classList.add('open');
  });
  document.getElementById('close-plano').addEventListener('click', () => modalPlano.classList.remove('open'));

  formPlano.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('p-imagen');
    if (!fileInput.files[0]) return showToast('Selecciona una imagen', 'error');
    
    const formData = new FormData();
    formData.append('sitio', currentSitioId);
    formData.append('area', currentAreaId);
    formData.append('nombre', document.getElementById('p-nombre').value.trim());
    formData.append('imagen_plano', fileInput.files[0]);

    try {
      const res = await fetch('https://simuladorrender.com/api/planos', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('âœ… Plano subido', 'success');
      modalPlano.classList.remove('open');
      cargarPlanosDelArea();
    } catch(err) { showToast(err.message, 'error'); }
  });

  // â”€â”€ PAN & ZOOM â”€â”€
  function updateTransform() {
    planoContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  }

  document.getElementById('btn-zoom-in').addEventListener('click', () => { currentZoom *= 1.2; updateTransform(); renderMarcadores(); });
  document.getElementById('btn-zoom-out').addEventListener('click', () => { currentZoom /= 1.2; updateTransform(); renderMarcadores(); });
  document.getElementById('btn-zoom-reset').addEventListener('click', () => { currentZoom = 1; panX = 0; panY = 0; updateTransform(); renderMarcadores(); });

  let startX, startY, initialPanX, initialPanY;
  let hasDragged = false;
  canvasWrapper.addEventListener('mousedown', (e) => {
    if (e.target.closest('.marcador') || e.target.closest('.rotate-handle')) return;
    isPanning = true;
    hasDragged = false;
    startX = e.clientX; startY = e.clientY;
    initialPanX = panX; initialPanY = panY;
    canvasWrapper.style.cursor = 'grab';
  });
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
      hasDragged = true;
    }
    panX = initialPanX + (e.clientX - startX);
    panY = initialPanY + (e.clientY - startY);
    updateTransform();
  });
  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      canvasWrapper.style.cursor = 'default';
      // Resetear hasDragged con retraso Ã­nfimo para que click lo evalÃºe a tiempo
      setTimeout(() => hasDragged = false, 50);
    }
  });

  canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    if(e.target.closest('.marcador-drawer')) return;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    
    const rect = canvasWrapper.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newZoom = currentZoom * zoomFactor;
    
    // Zoom hacia el mouse
    panX = mouseX - (mouseX - panX) * zoomFactor;
    panY = mouseY - (mouseY - panY) * zoomFactor;
    currentZoom = newZoom;
    
    updateTransform();
    renderMarcadores(); // Re-escalar info
  }, { passive: false });

  // â”€â”€ MARCADORES â”€â”€
  async function cargarMarcadores() {
    if (!currentPlanoId) return;
    try {
      const res = await apiFetch(`/planos/marcadores/${currentPlanoId}`);
      marcadores = res.marcadores || [];
      renderMarcadores();
    } catch(err) { showToast('Error cargando marcadores: ' + err.message, 'error'); }
  }

  function getIconForTipo(m) {
    const tipo = m.tipo;
    if (tipo === 'AP') {
      return `<svg width="48" height="48" viewBox="-12 -12 48 48" style="overflow:visible;"><circle cx="12" cy="12" r="8" stroke="#3b82f6" stroke-width="2" fill="none" style="animation: ap-waves 2s infinite linear;"></circle><circle cx="12" cy="12" r="8" stroke="#3b82f6" stroke-width="2" fill="none" style="animation: ap-waves 2s infinite linear 1s;"></circle><circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#ffffff" stroke-width="2" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));"></circle></svg>`;
    }
    if (tipo === 'CÃ¡mara') {
      const fov = Number(m.fov) || 90; 
      const cx = 30, cy = 15, r = 28;
      const halfRad = (fov / 2) * (Math.PI / 180);
      const startAngle = (Math.PI / 2) - halfRad;
      const endAngle = (Math.PI / 2) + halfRad;
      const startX = cx + r * Math.cos(startAngle);
      const startY = cy + r * Math.sin(startAngle);
      const endX = cx + r * Math.cos(endAngle);
      const endY = cy + r * Math.sin(endAngle);
      const largeArcFlag = fov > 180 ? 1 : 0;
      const pathD = fov === 0 ? '' : `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
      return `<svg width="60" height="60" viewBox="0 0 60 60" style="overflow:visible;"><path d="${pathD}" fill="rgba(239,68,68,0.25)"></path><rect x="23" y="10" width="14" height="10" rx="2" fill="#ef4444" stroke="#ffffff" stroke-width="1.5"></rect></svg>`;
    }
    if (tipo === 'Nodo') return `<svg width="32" height="32" viewBox="0 0 24 24" fill="#10b981" stroke="#ffffff" stroke-width="1.5"><rect x="2" y="14" width="20" height="8" rx="2"></rect><circle cx="19" cy="18" r="1.5" fill="#10b981" style="animation: node-blink 1.5s infinite;"></circle></svg>`;
    if (tipo === 'Cuarto') return `<svg width="32" height="32" viewBox="0 0 24 24" fill="#4f46e5" stroke="#ffffff" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"></rect></svg>`;
    return `<svg width="32" height="32" viewBox="0 0 24 24" fill="#64748b" stroke="#ffffff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
  }

  function renderMarcadores() {
    const invScale = 1 / currentZoom;
    marcadoresLayer.innerHTML = marcadores.map(m => `
      <div class="marcador" data-id="${m._id}" style="left:${m.x}%; top:${m.y}%; width:0; height:0; position:absolute; transform:scale(${invScale}); z-index:5; cursor:pointer; pointer-events:all;">
        <div class="marcador-icon-wrapper" style="position:absolute; left:0; top:0; transform:translate(-50%, -50%) rotate(${m.tipo === 'CÃ¡mara' ? (m.angulo || 0) : 0}deg);">
           ${getIconForTipo(m)}
        </div>
        <div style="position:absolute; top:20px; left:0; transform:translateX(-50%); background:rgba(15, 23, 42, 0.9); color:#fff; font-size:10px; font-weight:600; padding:2px 6px; border-radius:12px;">${m.nombre}</div>
      </div>
    `).join('');

    marcadoresLayer.querySelectorAll('.marcador').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirMarcadorDrawer(el.dataset.id);
      });
    });
  }

  function abrirMarcadorDrawer(id) {
    const m = marcadores.find(x => x._id === id);
    if (!m) return;
    
    document.getElementById('drawer-title').innerHTML = `ðŸ“ ${m.nombre}`;
    document.getElementById('drawer-tipo').textContent = m.tipo;
    
    // Mostrar detalles estructurados
    const redBlock = document.getElementById('drawer-red-block');
    const redTabla = document.getElementById('drawer-red-tabla');
    const detallestxt = document.getElementById('drawer-detalles');
    try {
      const det = JSON.parse(m.detalles || '{}');
      const filas = [
        ['IP',      det.ip],
        ['MÃ¡scara', det.subnet],
        ['Gateway', det.gateway],
        ['MAC',     det.mac],
        ['N/S',     det.ns],
        ['VLAN',    det.vlan],
        ['Notas',   det.notas]
      ].filter(([,v]) => v);
      if (filas.length) {
        redTabla.innerHTML = filas.map(([k, v]) => 
          `<span style="font-weight:600;color:var(--text-muted);">${k}</span><span style="color:var(--text-primary);">${v}</span>`
        ).join('');
        redBlock.style.display = 'block';
        if(detallestxt) detallestxt.parentElement.style.display = 'none';
      } else {
        redBlock.style.display = 'none';
        if(detallestxt) { detallestxt.parentElement.style.display = 'block'; detallestxt.textContent = 'â€”'; }
      }
    } catch(e) {
      redBlock.style.display = 'none';
      if(detallestxt) { detallestxt.parentElement.style.display = 'block'; detallestxt.textContent = m.detalles || 'Sin detalles.'; }
    }

    
    const imgEl = document.getElementById('drawer-foto');
    const emptyEl = document.getElementById('drawer-foto-empty');
    if (m.foto_url) {
      imgEl.src = 'https://simuladorrender.com/' + m.foto_url;
      imgEl.style.display = 'block';
      emptyEl.style.display = 'none';
      imgEl.onclick = () => {
        // Enlaza con visor lightbox global
        const modalLightbox = document.getElementById('modal-foto-lightbox');
        const lbImg = document.getElementById('lightbox-img');
        const lbTitle = document.getElementById('lightbox-title');
        if(modalLightbox && lbImg) {
          lbImg.src = imgEl.src;
          if(lbTitle) lbTitle.textContent = m.nombre;
          modalLightbox.classList.add('open');
        }
      };
    } else {
      imgEl.style.display = 'none';
      emptyEl.style.display = 'block';
      imgEl.src = '';
    }
    
    // Set edit and delete handles
    document.getElementById('btn-edit-marcador').onclick = () => abrirModalMarcador(m, m.x, m.y);
    document.getElementById('btn-delete-marcador').onclick = async () => {
      if(!confirm('Â¿Eliminar este marcador?')) return;
      try {
        await apiFetch(`/planos/marcadores/${m._id}`, { method: 'DELETE' });
        showToast('Marcador eliminado');
        drawer.classList.remove('open');
        cargarMarcadores();
      } catch(e) { showToast(e.message, 'error'); }
    };

    drawer.classList.add('open');
  }

  // Clic en el plano para agregar marcador
  let clickStartX, clickStartY;
  planoContainer.addEventListener('mousedown', (e) => { clickStartX = e.clientX; clickStartY = e.clientY; });
  planoContainer.addEventListener('click', (e) => {
    if (!currentPlanoId || hasDragged) return;
    if (e.target.closest('.marcador') || e.target.closest('.rotate-handle')) return;
    
    const rect = planoContainer.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    abrirModalMarcador(null, x, y);
  });

  function abrirModalMarcador(marcador = null, x = 0, y = 0) {
    formMarcador.reset();
    document.getElementById('m-id').value = marcador ? marcador._id : '';
    document.getElementById('m-x').value = marcador ? marcador.x : x;
    document.getElementById('m-y').value = marcador ? marcador.y : y;
    
    // Limpiar campos estructurados
    document.getElementById('m-ip').value      = '';
    document.getElementById('m-mac').value     = '';
    document.getElementById('m-subnet').value  = '';
    document.getElementById('m-gateway').value = '';
    document.getElementById('m-ns').value      = '';
    document.getElementById('m-vlan').value    = '';
    document.getElementById('m-detalles').value = '';

    if (marcador) {
      document.getElementById('m-tipo').value = marcador.tipo;
      document.getElementById('m-nombre').value = marcador.nombre || '';
      
      // Deserializar detalles desde JSON
      try {
        const det = JSON.parse(marcador.detalles || '{}');
        document.getElementById('m-ip').value       = det.ip      || '';
        document.getElementById('m-mac').value      = det.mac     || '';
        document.getElementById('m-subnet').value   = det.subnet  || '';
        document.getElementById('m-gateway').value  = det.gateway || '';
        document.getElementById('m-ns').value       = det.ns      || '';
        document.getElementById('m-vlan').value     = det.vlan    || '';
        document.getElementById('m-detalles').value = det.notas   || '';
      } catch(e) {
        document.getElementById('m-detalles').value = marcador.detalles || '';
      }

      if (marcador.tipo === 'CÃ¡mara') {
        document.getElementById('group-angulo').style.display = 'block';
        document.getElementById('m-angulo').value = marcador.angulo || 0;
        document.getElementById('m-fov').value = marcador.fov || 90;
      } else {
        document.getElementById('group-angulo').style.display = 'none';
      }
    } else {
      document.getElementById('group-angulo').style.display = 'none';
    }
    
    document.getElementById('modal-marcador-title').textContent = marcador ? 'Editar Punto' : 'Nuevo Punto';
    modalMarcador.classList.add('open');
  }

  document.getElementById('close-marcador').addEventListener('click', () => modalMarcador.classList.remove('open'));
  document.getElementById('m-tipo').addEventListener('change', (e) => {
    document.getElementById('group-angulo').style.display = e.target.value === 'CÃ¡mara' ? 'block' : 'none';
  });

  formMarcador.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mId = document.getElementById('m-id').value;
    const file = document.getElementById('m-foto').files[0];
    
    const fd = new FormData();
    fd.append('plano', currentPlanoId);
    fd.append('tipo', document.getElementById('m-tipo').value);
    fd.append('nombre', document.getElementById('m-nombre').value.trim());
    
    // Serializar campos estructurados a JSON
    const detallesObj = {
      ip:      document.getElementById('m-ip').value.trim(),
      mac:     document.getElementById('m-mac').value.trim(),
      subnet:  document.getElementById('m-subnet').value.trim(),
      gateway: document.getElementById('m-gateway').value.trim(),
      ns:      document.getElementById('m-ns').value.trim(),
      vlan:    document.getElementById('m-vlan').value.trim(),
      notas:   document.getElementById('m-detalles').value.trim()
    };
    fd.append('detalles', JSON.stringify(detallesObj));
    fd.append('x', document.getElementById('m-x').value);
    fd.append('y', document.getElementById('m-y').value);
    fd.append('angulo', document.getElementById('m-angulo').value);
    fd.append('fov', document.getElementById('m-fov').value);
    if (file) fd.append('foto_marcador', file);

    try {
      const url = mId ? `https://simuladorrender.com/api/planos/marcadores/${mId}` : 'https://simuladorrender.com/api/planos/marcadores';
      const res = await fetch(url, {
        method: mId ? 'PUT' : 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      showToast('âœ… Punto guardado', 'success');
      modalMarcador.classList.remove('open');
      cargarMarcadores();
    } catch(err) { showToast(err.message, 'error'); }
  });

})();
