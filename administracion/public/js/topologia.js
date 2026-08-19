// js/topologia.js â€” Ãrbol Colapsable estilo Ruijie Cloud / Ubiquiti
// Flujo: Seleccionar Cliente â†’ Ãrbol (Sucursales colapsables â†’ Ãreas) â†’ Panel Detalle
(() => {
  const { apiFetch, requireAuth, showToast, invalidarCache } = window.auth;
  requireAuth();

  // â”€â”€ Estado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let clienteSeleccionado = null;
  let arbolData           = null;
  let abiertos            = new Set(); // IDs de sucursales expandidas
  let seleccionado        = { tipo: null, id: null }; // 'sitio' | 'area'

  // â”€â”€ DOM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selectCliente  = document.getElementById('select-cliente');
  const treeBody       = document.getElementById('tree-body');
  const detailPanel    = document.getElementById('detail-panel');
  const btnNuevaSuc    = document.getElementById('btn-nueva-sucursal');
  const loadingMask    = document.getElementById('loading-mask');
  const modalSucursal  = document.getElementById('modal-sucursal');
  const formSucursal   = document.getElementById('form-sucursal');
  const modalArea      = document.getElementById('modal-area');
  const formArea       = document.getElementById('form-area');
  const modalQR        = document.getElementById('modal-qr');
  const modalLightbox  = document.getElementById('modal-foto-lightbox');
  const lightboxImg     = document.getElementById('lightbox-img');
  const lightboxTitle   = document.getElementById('lightbox-title');
  const closeModalFoto  = document.getElementById('close-modal-foto');
  const inputFoto       = document.getElementById('a-foto');
  const fotoPreviewCont = document.getElementById('a-foto-preview-container');
  const fotoPreview     = document.getElementById('a-foto-preview');

  function formatFotoUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const baseUrl = 'https://simuladorrender.com';
    return `${baseUrl}/${url.replace(/^\//, '')}`;
  }

  function abrirLightbox(url, titulo) {
    if (!url) return;
    const fullUrl = formatFotoUrl(url);
    lightboxImg.src = fullUrl;
    lightboxTitle.textContent = titulo || 'Foto del Ãrea';
    openModal(modalLightbox);
  }
  if (closeModalFoto) closeModalFoto.addEventListener('click', () => closeModal(modalLightbox));
  if (modalLightbox) modalLightbox.addEventListener('click', e => { if (e.target === modalLightbox) closeModal(modalLightbox); });

  // â”€â”€ Modal QR (Descargable y Personalizado) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function abrirModalQR(areaId, areaNombre = 'Gabinete') {
    const isFileUrl = window.location.protocol === 'file:';
    
    // Construimos la URL al simulador
    let simuladorUrl = '';
    if (isFileUrl) {
      simuladorUrl = `https://simuladorrender.com/simulador.html?area=${areaId}`;
    } else {
      simuladorUrl = window.location.href.split('?')[0].replace('topologia.html', 'simulador.html') + '?area=' + areaId;
    }
    
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 1. Limpiar y Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 2. Cabecera (Naisata Soluciones)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Naisata Soluciones', canvas.width / 2, 40);
    
    // 3. Generar el QR usando librerÃ­a qrcode.js
    if (window.QRCode) {
      QRCode.toDataURL(simuladorUrl, { width: 230, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } }, function(err, url) {
        if (err) { showToast('Error generando QR', 'error'); return; }
        const img = new Image();
        img.onload = function() {
          ctx.drawImage(img, (canvas.width - 230) / 2, 60);
          
          // 4. Dibujar text inferior
          ctx.font = 'bold 16px sans-serif';
          ctx.fillStyle = '#1e293b';
          ctx.fillText('Detalle: ' + areaNombre, canvas.width / 2, 330);
          
          ctx.font = '14px sans-serif';
          ctx.fillStyle = '#475569';
          ctx.fillText('Escanea para saber la informaciÃ³n', canvas.width / 2, 360);
          ctx.fillText('de este rack o gabinete.', canvas.width / 2, 380);
          
          // 5. Contacto
          ctx.font = 'bold 15px sans-serif';
          ctx.fillStyle = '#0ea5e9';
          ctx.fillText('Contacto: naisata.com', canvas.width / 2, 415);
        };
        img.src = url;
      });
    } else {
      showToast('No se pudo cargar la librerÃ­a QR', 'error');
    }

    openModal(modalQR);
  }
  
  const closeModalQRBtn = document.getElementById('close-modal-qr');
  if (closeModalQRBtn) closeModalQRBtn.addEventListener('click', () => closeModal(modalQR));
  if (modalQR) modalQR.addEventListener('click', e => { if (e.target === modalQR) closeModal(modalQR); });

  // BotÃ³n descargar
  const btnDescargarQR = document.getElementById('btn-descargar-qr');
  if (btnDescargarQR) {
    btnDescargarQR.addEventListener('click', () => {
      const canvas = document.getElementById('qr-canvas');
      const link = document.createElement('a');
      link.download = 'Etiqueta_QR_Rack.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  // â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const showLoading = on => { loadingMask.style.display = on ? 'flex' : 'none'; };
  const openModal   = m => m.classList.add('open');
  const closeModal  = m => m.classList.remove('open');

  // â”€â”€ 1. Cargar clientes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function cargarClientes() {
    try {
      const data = await apiFetch('/clientes');
      selectCliente.innerHTML = '<option value="">â€” Seleccionar cliente â€”</option>';
      (data.clientes || []).forEach(c => {
        const o = document.createElement('option');
        o.value = c._id;
        o.textContent = c.empresa + (c.estado !== 'activo' ? ` (${c.estado})` : '');
        selectCliente.appendChild(o);
      });
    } catch (e) { showToast('Error al cargar clientes: ' + e.message, 'error'); }
  }

  selectCliente.addEventListener('change', async () => {
    const id = selectCliente.value;
    if (!id) {
      clienteSeleccionado = null; arbolData = null; abiertos.clear(); seleccionado = {};
      btnNuevaSuc.style.display = 'none';
      renderTreeEmpty();
      renderWelcome();
      return;
    }
    clienteSeleccionado = id;
    abiertos.clear();
    seleccionado = {};
    btnNuevaSuc.style.display = '';
    await cargarArbol(id);
  });

  // â”€â”€ 2. Cargar Ã¡rbol completo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function cargarArbol(clienteId, mantenerAbiertos = false) {
    try {
      showLoading(true);
      invalidarCache('topologia');
      const data = await apiFetch(`/topologia/arbol/${clienteId}`);
      arbolData = data.arbol;
      if (!mantenerAbiertos) abiertos.clear();
      renderTree(arbolData.sitios || []);
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // â”€â”€ 3. Render Ã¡rbol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderTree(sitios) {
    if (!sitios.length) {
      treeBody.innerHTML = `
        <div class="tree-empty">
          <div class="tree-empty-icon">ðŸ </div>
          No hay sucursales.<br>Presiona <strong>+ Sucursal</strong> para crear la primera.
        </div>`;
      return;
    }

    treeBody.innerHTML = sitios.map(sitio => {
      const areas = sitio.areas || [];
      const isOpen = abiertos.has(sitio._id);
      const isActiveSitio = seleccionado.tipo === 'sitio' && seleccionado.id === sitio._id;

      const areasHtml = areas.map(area => {
        const isActiveArea = seleccionado.tipo === 'area' && seleccionado.id === area._id;
        const thumbHtml = area.foto_url
          ? `<img src="${formatFotoUrl(area.foto_url)}" class="tree-leaf-thumb" data-foto-url="${area.foto_url}" data-nombre="${area.nombre}" title="Ver foto real del cuarto" />`
          : '';
        return `
          <div class="tree-leaf ${isActiveArea ? 'active' : ''}"
               data-area-id="${area._id}" data-sitio-id="${sitio._id}">
            <span class="tree-leaf-type type-${area.tipo}">${area.tipo}</span>
            <span class="tree-leaf-name">${area.nombre}</span>
            ${thumbHtml}
            <div class="tree-leaf-actions">
              <button class="tree-action-btn btn-qr-area" data-id="${area._id}" title="Generar QR para celular">ðŸ“±</button>
              <a href="simulador.html?area=${area._id}" class="tree-action-btn" title="Simulador Avanzado de Rack" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">ðŸŽ®</a>
              <button class="tree-action-btn btn-planos-area" data-id="${area._id}" data-nombre="${area.nombre}" title="Ver Planos">ðŸ—ºï¸</button>
              <button class="tree-action-btn btn-edit-area" data-id="${area._id}" title="Editar">âœï¸</button>
              <button class="tree-action-btn danger btn-del-area" data-id="${area._id}" data-nombre="${area.nombre}" title="Eliminar">ðŸ—‘ï¸</button>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="tree-node" data-sitio-id="${sitio._id}">
          <div class="tree-node-header ${isActiveSitio ? 'active' : ''}" data-sitio-id="${sitio._id}">
            <span class="tree-toggle ${isOpen ? 'open' : ''}">â–¶</span>
            <span class="tree-node-icon">ðŸ¢</span>
            <span class="tree-node-name">${sitio.nombre}</span>
            <span class="tree-node-count">${areas.length}</span>
            <div class="tree-node-actions">
              <button class="tree-action-btn btn-edit-suc" data-id="${sitio._id}" title="Editar sucursal">âœï¸</button>
              <button class="tree-action-btn danger btn-del-suc" data-id="${sitio._id}" data-nombre="${sitio.nombre}" title="Eliminar sucursal">ðŸ—‘ï¸</button>
            </div>
          </div>
          <div class="tree-children ${isOpen ? 'open' : ''}">
            ${areasHtml}
            <div class="tree-add-area" data-sitio-id="${sitio._id}">
              <span>ï¼‹</span> Nueva Ã¡rea
            </div>
          </div>
        </div>`;
    }).join('');

    // â”€â”€ Eventos del Ã¡rbol â”€â”€â”€
    // Expandir/colapsar sucursal (click en header)
    treeBody.querySelectorAll('.tree-node-header').forEach(header => {
      header.addEventListener('click', e => {
        // Si hizo click en un botÃ³n de acciÃ³n, no expandir
        if (e.target.closest('.tree-node-actions')) return;
        const sitioId = header.dataset.sitioId;
        const toggle  = header.querySelector('.tree-toggle');
        const children = header.nextElementSibling;

        if (abiertos.has(sitioId)) {
          abiertos.delete(sitioId);
          toggle.classList.remove('open');
          children.classList.remove('open');
        } else {
          abiertos.add(sitioId);
          toggle.classList.add('open');
          children.classList.add('open');
        }

        // Mostrar detalle de la sucursal
        const sitio = arbolData.sitios.find(s => s._id === sitioId);
        if (sitio) {
          seleccionado = { tipo: 'sitio', id: sitioId };
          resaltarActivo();
          renderDetalleSitio(sitio);
        }
      });
    });

    // Click en un Ã¡rea (hoja)
    treeBody.querySelectorAll('.tree-leaf').forEach(leaf => {
      leaf.addEventListener('click', e => {
        if (e.target.closest('.tree-leaf-actions, .tree-leaf-thumb')) return;
        const areaId  = leaf.dataset.areaId;
        const sitioId = leaf.dataset.sitioId;
        const sitio   = arbolData.sitios.find(s => s._id === sitioId);
        const area    = sitio?.areas?.find(a => a._id === areaId);
        if (!area) return;
        seleccionado = { tipo: 'area', id: areaId };
        resaltarActivo();
        renderDetalleArea(area, sitio);
      });
    });

    // Click en la miniatura de la foto para ampliar (lightbox)
    treeBody.querySelectorAll('.tree-leaf-thumb').forEach(img => {
      img.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        abrirLightbox(img.dataset.fotoUrl, img.dataset.nombre);
      });
    });

    // Botones editar/eliminar sucursal
    treeBody.querySelectorAll('.btn-edit-suc').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const sitio = arbolData.sitios.find(s => s._id === btn.dataset.id);
        if (sitio) abrirModalSucursal(sitio);
      });
    });
    treeBody.querySelectorAll('.btn-del-suc').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        eliminarSucursal(btn.dataset.id, btn.dataset.nombre);
      });
    });

    // Botones editar/eliminar Ã¡rea
    treeBody.querySelectorAll('.btn-edit-area').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const areaId = btn.dataset.id;
        for (const sitio of arbolData.sitios) {
          const area = sitio.areas?.find(a => a._id === areaId);
          if (area) { abrirModalArea(area, sitio._id); return; }
        }
      });
    });

    // Botones QR Ãrea
    treeBody.querySelectorAll('.btn-qr-area').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const areaId = btn.dataset.id;
        let nombre = 'Gabinete';
        for (const sitio of arbolData.sitios) {
          const area = sitio.areas?.find(a => a._id === areaId);
          if (area) { nombre = area.nombre; break; }
        }
        abrirModalQR(areaId, nombre);
      });
    });
    
    // Botones mapas area
    treeBody.querySelectorAll('.btn-planos-area').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const areaId = btn.dataset.id;
        const nombre = btn.dataset.nombre;
        for (const sitio of arbolData.sitios) {
          const area = sitio.areas?.find(a => a._id === areaId);
          if (area) { 
            seleccionado = { tipo: 'area', id: areaId };
            resaltarActivo();
            iniciarModoPlano(areaId, sitio._id, nombre); 
            return; 
          }
        }
      });
    });
    treeBody.querySelectorAll('.btn-del-area').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        eliminarArea(btn.dataset.id, btn.dataset.nombre);
      });
    });

    // BotÃ³n "Nueva Ã¡rea" dentro de cada sucursal
    treeBody.querySelectorAll('.tree-add-area').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        abrirModalArea(null, btn.dataset.sitioId);
      });
    });
  }

  function resaltarActivo() {
    treeBody.querySelectorAll('.tree-node-header').forEach(h => {
      h.classList.toggle('active', seleccionado.tipo === 'sitio' && h.dataset.sitioId === seleccionado.id);
    });
    treeBody.querySelectorAll('.tree-leaf').forEach(l => {
      l.classList.toggle('active', seleccionado.tipo === 'area' && l.dataset.areaId === seleccionado.id);
    });
  }

  // â”€â”€ 4. Panel bienvenida (en blanco) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderWelcome() {
    detailPanel.innerHTML = '';
  }

  // â”€â”€ 5. Panel detalle: Sitio (en blanco) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderDetalleSitio(sitio) {
    detailPanel.innerHTML = '';
  }

  // â”€â”€ 6. Panel detalle: Ãrea (en blanco) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderDetalleArea(area, sitio) {
    detailPanel.innerHTML = '';
  }

  // â”€â”€ 7. CRUD Sucursales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function abrirModalSucursal(sitio = null) {
    formSucursal.reset();
    document.getElementById('s-id').value = sitio?._id || '';
    document.getElementById('modal-sucursal-title').textContent = sitio ? 'Editar Sucursal' : 'Nueva Sucursal';
    if (sitio) {
      document.getElementById('s-nombre').value   = sitio.nombre   || '';
      document.getElementById('s-direccion').value = sitio.direccion || '';
      document.getElementById('s-estado').value    = sitio.estado   || 'activo';
      document.getElementById('s-notas').value     = sitio.notas    || '';
    }
    openModal(modalSucursal);
  }

  btnNuevaSuc.addEventListener('click', () => abrirModalSucursal());
  document.getElementById('close-modal-sucursal').addEventListener('click', () => closeModal(modalSucursal));
  document.getElementById('cancel-sucursal').addEventListener('click', () => closeModal(modalSucursal));
  modalSucursal.addEventListener('click', e => { if (e.target === modalSucursal) closeModal(modalSucursal); });

  formSucursal.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('s-id').value;
    const payload = {
      nombre:    document.getElementById('s-nombre').value.trim(),
      direccion: document.getElementById('s-direccion').value.trim(),
      estado:    document.getElementById('s-estado').value,
      notas:     document.getElementById('s-notas').value.trim(),
      cliente:   clienteSeleccionado,
    };
    if (!payload.nombre) { showToast('El nombre es requerido', 'error'); return; }
    try {
      showLoading(true);
      if (id) {
        await apiFetch(`/topologia/sitios/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('âœ… Sucursal actualizada');
      } else {
        await apiFetch('/topologia/sitios', { method: 'POST', body: JSON.stringify(payload) });
        showToast('âœ… Sucursal creada');
      }
      closeModal(modalSucursal);
      await cargarArbol(clienteSeleccionado, true);
      // Si editamos el sitio activo, re-renderizar detalle
      if (id && seleccionado.tipo === 'sitio' && seleccionado.id === id) {
        const sitioActualizado = arbolData.sitios.find(s => s._id === id);
        if (sitioActualizado) renderDetalleSitio(sitioActualizado);
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  async function eliminarSucursal(id, nombre) {
    if (!confirm(`Â¿Eliminar la sucursal "${nombre}" y todas sus Ã¡reas?`)) return;
    try {
      showLoading(true);
      await apiFetch(`/topologia/sitios/${id}`, { method: 'DELETE' });
      showToast('âœ… Sucursal eliminada');
      if (seleccionado.id === id) { seleccionado = {}; renderWelcome(); }
      abiertos.delete(id);
      await cargarArbol(clienteSeleccionado, true);
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // â”€â”€ 8. CRUD Ãreas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function toggleAreaConds() {
    const cuarto = document.getElementById('a-cuarto').value;
    const fibra  = document.getElementById('a-fibra-lui').checked;
    const pp     = document.getElementById('a-patchpanels').checked;
    const sw     = document.getElementById('a-switch').checked;
    document.getElementById('row-rack-u').style.display      = cuarto !== 'Ninguno' ? 'block' : 'none';
    document.getElementById('row-fibra-cant').style.display   = fibra ? 'block' : 'none';
    document.getElementById('row-pp-puertos').style.display   = pp    ? 'block' : 'none';
    document.getElementById('row-switch-det').style.display   = sw    ? 'block' : 'none';
  }
  ['a-cuarto','a-fibra-lui','a-patchpanels','a-switch'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', toggleAreaConds);
  });

  function abrirModalArea(area = null, sitioId = null) {
    formArea.reset();
    if (inputFoto) inputFoto.value = '';
    document.getElementById('a-id').value      = area?._id   || '';
    document.getElementById('a-sitio-id').value = sitioId    || sucursalDeSel() || '';
    document.getElementById('modal-area-title').textContent = area ? 'Editar Ãrea' : 'Nueva Ãrea';

    if (area && area.foto_url) {
      if (fotoPreview) fotoPreview.src = formatFotoUrl(area.foto_url);
      if (fotoPreviewCont) fotoPreviewCont.style.display = 'flex';
    } else {
      if (fotoPreviewCont) fotoPreviewCont.style.display = 'none';
    }

    toggleAreaConds();
    if (area) {
      document.getElementById('a-nombre').value        = area.nombre || '';
      document.getElementById('a-tipo').value          = area.tipo || 'IDF';
      document.getElementById('a-cuarto').value        = area.cuarto || 'Ninguno';
      document.getElementById('a-rack-u').value        = area.rack_unidades_totales || 42;
      document.getElementById('a-fibra-lui').checked   = area.fibra_lui || false;
      document.getElementById('a-fibra-cant').value    = area.fibra_cantidad || 0;
      document.getElementById('a-internet-prov').value = area.internet_proveedor || '';
      document.getElementById('a-internet-tipo').value = area.internet_tipo || 'Ninguno';
      document.getElementById('a-firewall').value      = area.firewall || 'Ninguno';
      document.getElementById('a-patchpanels').checked = area.patchpanels || false;
      document.getElementById('a-pp-puertos').value    = area.patchpanels_puertos || 0;
      document.getElementById('a-organizador').checked = area.organizador || false;
      document.getElementById('a-switch').checked      = area.switch || false;
      document.getElementById('a-switch-puertos').value = area.switch_puertos || '';
      document.getElementById('a-switch-fibra').checked = area.switch_fibra || false;
      document.getElementById('a-router').checked      = area.router || false;
      document.getElementById('a-router-fibra').checked = area.router_fibra || false;
      document.getElementById('a-notas').value         = area.notas || '';
      toggleAreaConds();
    }
    openModal(modalArea);
  }

  // Obtener sitioId del elemento seleccionado actualmente
  function sucursalDeSel() {
    if (seleccionado.tipo === 'sitio') return seleccionado.id;
    if (seleccionado.tipo === 'area') {
      for (const sitio of (arbolData?.sitios || [])) {
        if (sitio.areas?.some(a => a._id === seleccionado.id)) return sitio._id;
      }
    }
    return null;
  }

  document.getElementById('close-modal-area').addEventListener('click', () => closeModal(modalArea));
  document.getElementById('cancel-area').addEventListener('click', () => closeModal(modalArea));
  modalArea.addEventListener('click', e => { if (e.target === modalArea) closeModal(modalArea); });

  formArea.addEventListener('submit', async e => {
    e.preventDefault();
    const id      = document.getElementById('a-id').value;
    const sitioId = document.getElementById('a-sitio-id').value;
    const nombre  = document.getElementById('a-nombre').value.trim();

    if (!nombre) { showToast('El nombre es requerido', 'error'); return; }

    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('tipo', document.getElementById('a-tipo').value);
    formData.append('cuarto', document.getElementById('a-cuarto').value);
    formData.append('rack_unidades_totales', Number(document.getElementById('a-rack-u').value) || 42);
    formData.append('fibra_lui', document.getElementById('a-fibra-lui').checked);
    formData.append('fibra_cantidad', Number(document.getElementById('a-fibra-cant').value) || 0);
    formData.append('internet_proveedor', document.getElementById('a-internet-prov').value.trim());
    formData.append('internet_tipo', document.getElementById('a-internet-tipo').value);
    formData.append('firewall', document.getElementById('a-firewall').value);
    formData.append('patchpanels', document.getElementById('a-patchpanels').checked);
    formData.append('patchpanels_puertos', Number(document.getElementById('a-pp-puertos').value) || 0);
    formData.append('organizador', document.getElementById('a-organizador').checked);
    formData.append('switch', document.getElementById('a-switch').checked);
    formData.append('switch_puertos', document.getElementById('a-switch-puertos').value);
    formData.append('switch_fibra', document.getElementById('a-switch-fibra').checked);
    formData.append('router', document.getElementById('a-router').checked);
    formData.append('router_fibra', document.getElementById('a-router-fibra').checked);
    formData.append('notas', document.getElementById('a-notas').value.trim());
    formData.append('sitio', sitioId);

    const fotoFile = inputFoto?.files[0];
    if (fotoFile) {
      formData.append('foto', fotoFile);
    }

    try {
      showLoading(true);
      if (id) {
        await apiFetch(`/topologia/areas/${id}`, { method: 'PUT', body: formData });
        showToast('âœ… Ãrea actualizada');
      } else {
        await apiFetch('/topologia/areas', { method: 'POST', body: formData });
        showToast('âœ… Ãrea creada');
      }
      closeModal(modalArea);
      await cargarArbol(clienteSeleccionado, true);
      const sitioActualizado = arbolData.sitios.find(s => s._id === sitioId);
      if (sitioActualizado) {
        if (id && seleccionado.tipo === 'area' && seleccionado.id === id) {
          const areaActualizada = sitioActualizado.areas?.find(a => a._id === id);
          if (areaActualizada) renderDetalleArea(areaActualizada, sitioActualizado);
        } else {
          seleccionado = { tipo: 'sitio', id: sitioId };
          resaltarActivo();
          renderDetalleSitio(sitioActualizado);
        }
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  });

  async function eliminarArea(id, nombre) {
    if (!confirm(`Â¿Eliminar el Ã¡rea "${nombre}"?`)) return;
    try {
      showLoading(true);
      const sitioId = sucursalDeSel();
      await apiFetch(`/topologia/areas/${id}`, { method: 'DELETE' });
      showToast('âœ… Ãrea eliminada');
      if (seleccionado.tipo === 'area' && seleccionado.id === id) {
        seleccionado = { tipo: 'sitio', id: sitioId };
      }
      await cargarArbol(clienteSeleccionado, true);
      const sitioActualizado = arbolData.sitios.find(s => s._id === sitioId);
      if (sitioActualizado) { resaltarActivo(); renderDetalleSitio(sitioActualizado); }
      else renderWelcome();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  cargarClientes();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', e => { e.preventDefault(); window.auth.logout(); });

  const u = window.auth.getUser();
  if (u) {
    const el = document.getElementById('user-name');
    const av = document.getElementById('user-avatar');
    if (el) el.textContent = u.nombre || u.email;
    if (av) av.textContent = (u.nombre || u.email || 'A')[0].toUpperCase();
  }

})();
