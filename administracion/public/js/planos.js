document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch, getToken, showToast, requireAuth } = window.auth;
  requireAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const sitioId = urlParams.get('sitioId');
  const sitioNombreRaw = urlParams.get('sitioNombre') || '';

  if (!sitioId) {
    showToast('No se especificÃ³ un sitio', 'error');
    return;
  }

  document.getElementById('sitio-nombre').textContent = decodeURIComponent(sitioNombreRaw) || 'Sitio';

  let planosList = [];
  let currentPlanoId = null;
  let currentZoom = 1;
  let panX = 0, panY = 0;
  let marcadores = [];
  let currentMarcadorId = null;

  // DOM Elements
  const planoListEl = document.getElementById('plano-list');
  const planoContainer = document.getElementById('plano-container');
  const emptyState = document.getElementById('empty-state');
  const planoImg = document.getElementById('plano-img');
  const planoCanvas = document.getElementById('plano-canvas');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const marcadoresLayer = document.getElementById('marcadores-layer');
  const drawer = document.getElementById('marcador-drawer');

  // Modals
  const modalPlano = document.getElementById('modal-plano');
  const modalMarcador = document.getElementById('modal-marcador');
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');

  // â”€â”€ Cargar Planos â”€â”€
  async function cargarPlanos() {
    try {
      const res = await apiFetch(`/planos/${sitioId}`);
      planosList = res.planos || [];
      renderListaPlanos();
      
      if (planosList.length > 0) {
        const toSelect = (currentPlanoId && planosList.find(p => p._id === currentPlanoId))
          ? currentPlanoId
          : planosList[0]._id;
        seleccionarPlano(toSelect);
      } else {
        emptyState.style.display = 'flex';
        planoContainer.style.display = 'none';
        marcadoresLayer.innerHTML = '';
        currentPlanoId = null;
      }
    } catch(err) { showToast('Error cargando planos: ' + err.message, 'error'); }
  }

  function renderListaPlanos() {
    if (planosList.length === 0) {
      planoListEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px;">Sin planos aÃºn. Crea el primero.</div>';
      return;
    }
    planoListEl.innerHTML = planosList.map(p => `
      <div class="plano-item ${p._id === currentPlanoId ? 'active' : ''}" onclick="seleccionarPlano('${p._id}')">
        <span>ðŸ“„ ${p.nombre}</span>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); eliminarPlano('${p._id}')" style="color:var(--danger); padding:2px 6px; font-size:12px;">âœ•</button>
      </div>
    `).join('');
  }

  window.seleccionarPlano = (id) => {
    currentPlanoId = id;
    renderListaPlanos();
    const plano = planosList.find(p => p._id === id);
    if (plano) {
      emptyState.style.display = 'none';
      planoContainer.style.display = 'inline-block';
      
      currentZoom = 1; panX = 0; panY = 0;
      updateTransform();

      const url = 'https://simuladorrender.com/' + plano.imagen_url;
      if (url.toLowerCase().endsWith('.pdf')) {
        planoImg.style.display = 'none';
        planoCanvas.style.display = 'block';
        const renderPDF = async () => {
          try {
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 }); // Render at 2x for better resolution
            planoCanvas.width = viewport.width;
            planoCanvas.height = viewport.height;
            planoCanvas.style.width = (viewport.width / 2) + 'px'; // Display at normal size
            const ctx = planoCanvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            cargarMarcadores();
          } catch (e) {
            console.error('Error loading PDF', e);
            showToast('Error cargando PDF', 'error');
          }
        };
        renderPDF();
      } else {
        planoCanvas.style.display = 'none';
        planoImg.style.display = 'block';
        planoImg.src = url;
        planoImg.onload = () => {
          cargarMarcadores();
        };
      }
    }
  };

  window.eliminarPlano = async (id) => {
    if (!confirm('âš ï¸ Â¿EstÃ¡s seguro de eliminar este plano y TODOS sus puntos?')) return;
    try {
      await apiFetch(`/planos/${id}`, { method: 'DELETE' });
      showToast('Plano eliminado', 'success');
      if (currentPlanoId === id) {
        currentPlanoId = null;
        emptyState.style.display = 'flex';
        planoContainer.style.display = 'none';
        marcadoresLayer.innerHTML = '';
      }
      cargarPlanos();
    } catch(err) { showToast(err.message, 'error'); }
  };

  // â”€â”€ Modales Plano â”€â”€
  document.getElementById('btn-add-plano').addEventListener('click', () => {
    document.getElementById('form-plano').reset();
    modalPlano.classList.add('open');
  });
  document.getElementById('close-plano').addEventListener('click', () => modalPlano.classList.remove('open'));

  document.getElementById('form-plano').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('p-imagen');
    if (!fileInput.files[0]) return showToast('Selecciona una imagen', 'error');
    
    const formData = new FormData();
    formData.append('sitio', sitioId);
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
      cargarPlanos();
    } catch(err) { showToast(err.message, 'error'); }
  });

  // â”€â”€ Marcadores â”€â”€
  async function cargarMarcadores() {
    if (!currentPlanoId) return;
    try {
      const res = await apiFetch(`/planos/marcadores/${currentPlanoId}`);
      marcadores = res.marcadores || [];
      renderMarcadores();
    } catch(err) { showToast('Error cargando marcadores: ' + err.message, 'error'); }
  }

  document.getElementById('m-tipo').addEventListener('change', (e) => {
    document.getElementById('group-angulo').style.display = e.target.value === 'CÃ¡mara' ? 'block' : 'none';
  });

  document.getElementById('m-angulo').addEventListener('input', (e) => {
    document.getElementById('angulo-val').textContent = e.target.value;
    updatePreviewCamara();
  });

  document.getElementById('m-fov').addEventListener('input', (e) => {
    document.getElementById('fov-val').textContent = e.target.value;
    updatePreviewCamara();
  });

  function updatePreviewCamara() {
    const previewContainer = document.getElementById('preview-camara-container');
    if (previewContainer) {
      previewContainer.innerHTML = getIconForTipo({ 
        tipo: 'CÃ¡mara', 
        angulo: document.getElementById('m-angulo').value,
        fov: document.getElementById('m-fov').value
      });
    }
  }

  function getIconForTipo(m) {
    const tipo = m.tipo;
    const angulo = m.angulo || 0;
    
    if (tipo === 'AP') {
      return `<svg width="48" height="48" viewBox="-12 -12 48 48" style="overflow:visible;">
        <circle cx="12" cy="12" r="8" stroke="#3b82f6" stroke-width="2" fill="none" style="animation: ap-waves 2s infinite linear;"></circle>
        <circle cx="12" cy="12" r="8" stroke="#3b82f6" stroke-width="2" fill="none" style="animation: ap-waves 2s infinite linear 1s;"></circle>
        <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#ffffff" stroke-width="2" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));"></circle>
        <circle cx="12" cy="12" r="3" fill="#ffffff" stroke="none"></circle>
      </svg>`;
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
      const pathD = fov === 0 
        ? '' 
        : `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

      return `<svg width="60" height="60" viewBox="0 0 60 60" style="overflow:visible;">
        <path d="${pathD}" fill="rgba(239,68,68,0.25)" stroke="none"></path>
        <rect x="23" y="10" width="14" height="10" rx="2" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));"></rect>
        <circle cx="30" cy="15" r="3" fill="#ffffff" stroke="none"></circle>
      </svg>`;
    }
    if (tipo === 'Nodo') {
      return `<svg width="32" height="32" viewBox="0 0 24 24" fill="#10b981" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));">
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
        <path d="M6 18h.01"></path><path d="M10 18h.01"></path><path d="M14 18h.01"></path>
        <circle cx="19" cy="18" r="1.5" fill="#10b981" stroke="none" style="animation: node-blink 1.5s infinite;"></circle>
        <path d="M12 14V2"></path>
      </svg>`;
    }
    
    const svgs = {
      'Cuarto': `<svg width="32" height="32" viewBox="0 0 24 24" fill="#4f46e5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect><line x1="2" y1="8" x2="22" y2="8"></line><line x1="2" y1="16" x2="22" y2="16"></line><circle cx="6" cy="5" r="1"></circle><circle cx="6" cy="12" r="1"></circle><circle cx="6" cy="19" r="1"></circle></svg>`,
      'Enlace': `<svg width="32" height="32" viewBox="0 0 24 24" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));"><path d="M12 2v20"></path><path d="m4.93 10.93 14.14 14.14"></path><path d="m2 22 20-20"></path><path d="m10.93 4.93 14.14 14.14"></path></svg>`,
      'Otro': `<svg width="32" height="32" viewBox="0 0 24 24" fill="#64748b" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`
    };
    return svgs[tipo] || svgs['Otro'];
  }

  function renderMarcadores() {
    const invScale = 1 / currentZoom;
    marcadoresLayer.innerHTML = marcadores.map(m => `
      <div class="marcador" data-id="${m._id}" style="left:${m.x}%; top:${m.y}%; width:0; height:0; pointer-events:all; position:absolute; transform:scale(${invScale}); cursor:pointer; z-index:5; transition:transform 0.15s;">
        <div class="marcador-icon-wrapper" data-angle="${m.tipo === 'CÃ¡mara' ? (m.angulo || 0) : 0}" style="position:absolute; left:0; top:0; transform:translate(-50%, -50%) rotate(${m.tipo === 'CÃ¡mara' ? (m.angulo || 0) : 0}deg); display:flex; justify-content:center; align-items:center;">
           ${getIconForTipo(m)}
           ${m.tipo === 'CÃ¡mara' ? '<div class="rotate-handle" title="Arrastrar para girar" style="position:absolute; bottom:-12px; left:50%; transform:translateX(-50%); width:16px; height:16px; background:#ef4444; border:2px solid #fff; border-radius:50%; cursor:grab; pointer-events:all; box-shadow:0 2px 5px rgba(0,0,0,0.4); z-index:10;"></div>' : ''}
        </div>
        <div style="position:absolute; top:20px; left:0; transform:translateX(-50%); background:rgba(15, 23, 42, 0.9); color:#fff; font-size:10px; font-weight:600; padding:3px 8px; border-radius:12px; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1);">${m.nombre}</div>
        <div class="mtt" style="position:absolute; bottom:30px; left:0; transform:translateX(-50%); background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:12px; pointer-events:none; opacity:0; transition:0.2s; white-space:nowrap; z-index:20; color:#1e293b; min-width:100px;">
          <strong style="display:block; color:#1677ff; margin-bottom:2px;">${m.tipo}</strong>
          ${m.nombre}
          ${m.detalles ? '<div style="color:#64748b;font-size:11px;margin-top:4px;">' + m.detalles.substring(0, 60) + (m.detalles.length > 60 ? 'â€¦' : '') + '</div>' : ''}
        </div>
      </div>
    `).join('');

    // Listeners
    marcadoresLayer.querySelectorAll('.marcador').forEach(el => {
      const tt = el.querySelector('.mtt');
      el.addEventListener('mouseenter', () => { if(tt) tt.style.opacity = '1'; el.style.transform = `scale(${(1.15) / currentZoom})`; });
      el.addEventListener('mouseleave', () => { if(tt) tt.style.opacity = '0'; el.style.transform = `scale(${1 / currentZoom})`; });
      el.addEventListener('click', (ev) => { ev.stopPropagation(); abrirMarcador(el.dataset.id); });
    });
  }

  // Click en el plano para agregar marcador (previniendo si hubo arrastre)
  let clickStartX, clickStartY;
  
  // Agregar cursor de ayuda
  const cursorHelper = document.createElement('div');
  cursorHelper.style.cssText = 'position:fixed; pointer-events:none; background:rgba(22, 119, 255, 0.9); color:#fff; font-size:11px; font-weight:600; padding:4px 10px; border-radius:20px; box-shadow:0 2px 8px rgba(0,0,0,0.2); transform:translate(15px, 15px); opacity:0; transition:opacity 0.2s; z-index:100;';
  cursorHelper.textContent = 'ðŸ“ Clic para sembrar punto';
  document.body.appendChild(cursorHelper);

  canvasWrapper.addEventListener('mouseenter', () => { if(!isPanning && currentPlanoId) cursorHelper.style.opacity = '1'; });
  canvasWrapper.addEventListener('mouseleave', () => cursorHelper.style.opacity = '0');
  canvasWrapper.addEventListener('mousemove', (e) => {
    if (isPanning) { cursorHelper.style.opacity = '0'; return; }
    if (currentPlanoId) {
      cursorHelper.style.opacity = '1';
      cursorHelper.style.left = e.clientX + 'px';
      cursorHelper.style.top = e.clientY + 'px';
    }
  });

  planoContainer.addEventListener('mousedown', (e) => {
    clickStartX = e.clientX;
    clickStartY = e.clientY;
  });
  
  planoContainer.addEventListener('click', (e) => {
    if (!currentPlanoId) return;
    if (e.target.closest('.marcador')) return;
    const dist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
    if (dist > 5) return; // Se considera arrastre
    
    // Feedback visual (Ripple)
    const ripple = document.createElement('div');
    ripple.style.cssText = `position:absolute; width:20px; height:20px; background:var(--primary); border-radius:50%; pointer-events:none; left:${e.clientX - 10}px; top:${e.clientY - 10}px; z-index:9999; animation: ripple-anim 0.5s ease-out forwards;`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);

    const rect = (planoImg.style.display !== 'none' ? planoImg : planoCanvas).getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    
    setTimeout(() => abrirModalMarcador(null, xPercent, yPercent), 150);
  });

  document.getElementById('close-marcador').addEventListener('click', () => modalMarcador.classList.remove('open'));

  function abrirModalMarcador(id = null, x = 0, y = 0) {
    document.getElementById('form-marcador').reset();
    document.getElementById('m-id').value = id || '';

    if (id) {
      const m = marcadores.find(mx => mx._id === id);
      if (m) {
        document.getElementById('m-tipo').value = m.tipo;
        document.getElementById('m-nombre').value = m.nombre;
        document.getElementById('m-detalles').value = m.detalles || '';
        document.getElementById('m-x').value = m.x;
        document.getElementById('m-y').value = m.y;
        document.getElementById('m-angulo').value = m.angulo || 0;
        document.getElementById('angulo-val').textContent = m.angulo || 0;
        document.getElementById('m-fov').value = m.fov || 90;
        document.getElementById('fov-val').textContent = m.fov || 90;
        updatePreviewCamara();
        document.getElementById('group-angulo').style.display = m.tipo === 'CÃ¡mara' ? 'block' : 'none';
        document.getElementById('modal-marcador-title').textContent = 'Editar Punto';
      }
    } else {
      document.getElementById('m-x').value = x;
      document.getElementById('m-y').value = y;
      document.getElementById('m-angulo').value = 0;
      document.getElementById('angulo-val').textContent = '0';
      document.getElementById('m-fov').value = 90;
      document.getElementById('fov-val').textContent = '90';
      updatePreviewCamara();
      document.getElementById('group-angulo').style.display = 'none';
      document.getElementById('modal-marcador-title').textContent = 'Agregar Punto en el Plano';
    }
    modalMarcador.classList.add('open');
  }

  document.getElementById('form-marcador').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('m-id').value;
    const url = 'https://simuladorrender.com/api/planos/marcadores' + (id ? '/' + id : '');
    const method = id ? 'PUT' : 'POST';

    const formData = new FormData();
    if (!id) formData.append('plano', currentPlanoId);
    formData.append('tipo', document.getElementById('m-tipo').value);
    formData.append('nombre', document.getElementById('m-nombre').value.trim());
    formData.append('detalles', document.getElementById('m-detalles').value);
    formData.append('x', document.getElementById('m-x').value);
    formData.append('y', document.getElementById('m-y').value);
    if (document.getElementById('m-tipo').value === 'CÃ¡mara') {
      formData.append('angulo', document.getElementById('m-angulo').value);
      formData.append('fov', document.getElementById('m-fov').value);
    } else {
      formData.append('angulo', 0);
      formData.append('fov', 90);
    }
    const fotoFile = document.getElementById('m-foto').files[0];
    if (fotoFile) formData.append('foto_marcador', fotoFile);

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(id ? 'âœ… Punto actualizado' : 'âœ… Punto agregado', 'success');
      modalMarcador.classList.remove('open');
      drawer.classList.remove('open');
      cargarMarcadores();
    } catch(err) { showToast(err.message, 'error'); }
  });

  // Drawer de marcador
  window.abrirMarcador = (id) => {
    currentMarcadorId = id;
    const m = marcadores.find(mx => mx._id === id);
    if (!m) return;

    document.getElementById('drawer-title').innerHTML = `${getIconForTipo(m)} <span style="margin-left:8px;">${m.nombre}</span>`;
    document.getElementById('drawer-tipo').textContent = m.tipo;
    document.getElementById('drawer-detalles').textContent = m.detalles || 'â€”';

    const fotoEl = document.getElementById('drawer-foto');
    const fotoEmpty = document.getElementById('drawer-foto-empty');
    if (m.foto_url) {
      fotoEl.src = 'https://simuladorrender.com/' + m.foto_url;
      fotoEl.style.display = 'block';
      fotoEmpty.style.display = 'none';
    } else {
      fotoEl.src = '';
      fotoEl.style.display = 'none';
      fotoEmpty.style.display = 'block';
    }
    drawer.classList.add('open');
  };

  document.getElementById('drawer-close').addEventListener('click', () => drawer.classList.remove('open'));

  document.getElementById('btn-edit-marcador').addEventListener('click', () => {
    if (currentMarcadorId) abrirModalMarcador(currentMarcadorId);
  });

  document.getElementById('btn-delete-marcador').addEventListener('click', async () => {
    if (!currentMarcadorId) return;
    if (!confirm('âš ï¸ Â¿Eliminar este punto?')) return;
    try {
      await apiFetch(`/planos/marcadores/${currentMarcadorId}`, { method: 'DELETE' });
      showToast('Punto eliminado', 'success');
      drawer.classList.remove('open');
      cargarMarcadores();
    } catch(err) { showToast(err.message, 'error'); }
  });

  // Lightbox
  document.getElementById('lightbox-close').addEventListener('click', () => { lightboxModal.style.display = 'none'; });
  window.abrirFoto = (url) => { lightboxImg.src = url; lightboxModal.style.display = 'flex'; };

  // Pan and Zoom and Rotate
  let isPanning = false;
  let isRotating = false;
  let startX = 0, startY = 0;
  let rotatingMarcadorId = null;
  let rotatingWrapper = null;
  
  canvasWrapper.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('rotate-handle')) {
      e.stopPropagation();
      e.preventDefault();
      isRotating = true;
      const marcadorEl = e.target.closest('.marcador');
      rotatingMarcadorId = marcadorEl.dataset.id;
      rotatingWrapper = marcadorEl.querySelector('.marcador-icon-wrapper');
      canvasWrapper.style.cursor = 'grabbing';
      return;
    }
    if (e.target.closest('.marcador') || e.button !== 0) return;
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    canvasWrapper.style.cursor = 'grabbing';
  });
  
  window.addEventListener('mousemove', (e) => {
    if (isRotating && rotatingWrapper) {
      e.preventDefault();
      const rect = rotatingWrapper.getBoundingClientRect();
      // Center of the wrapper
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
      let finalAngle = Math.round(angle - 90);
      if (finalAngle < 0) finalAngle += 360;
      rotatingWrapper.style.transform = `translate(-50%, -50%) rotate(${finalAngle}deg)`;
      rotatingWrapper.dataset.angle = finalAngle;
      return;
    }
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform();
  });
  
  window.addEventListener('mouseup', async () => {
    if (isRotating) {
      isRotating = false;
      canvasWrapper.style.cursor = '';
      if (rotatingMarcadorId && rotatingWrapper) {
        const finalAngle = rotatingWrapper.dataset.angle;
        try {
          const m = marcadores.find(mx => mx._id === rotatingMarcadorId);
          if (m && finalAngle !== undefined) {
             m.angulo = Number(finalAngle);
             const formData = new FormData();
             formData.append('angulo', m.angulo);
             await fetch('https://simuladorrender.com/api/planos/marcadores/' + m._id, {
               method: 'PUT',
               headers: { 'Authorization': 'Bearer ' + getToken() },
               body: formData
             });
          }
        } catch(err) {
           showToast('Error guardando orientaciÃ³n', 'error');
        }
      }
      rotatingMarcadorId = null;
      rotatingWrapper = null;
      return;
    }
    if (isPanning) {
      isPanning = false;
      canvasWrapper.style.cursor = '';
    }
  });

  function updateTransform() { 
    planoContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    renderMarcadores(); // re-render para ajustar tamaÃ±o inverso
  }
  
  document.getElementById('btn-zoom-in').addEventListener('click', () => { currentZoom = Math.min(3, currentZoom + 0.2); updateTransform(); });
  document.getElementById('btn-zoom-out').addEventListener('click', () => { currentZoom = Math.max(0.2, currentZoom - 0.2); updateTransform(); });
  document.getElementById('btn-zoom-reset').addEventListener('click', () => { currentZoom = 1; panX = 0; panY = 0; updateTransform(); });


  // Init
  cargarPlanos();
});
