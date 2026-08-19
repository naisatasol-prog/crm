// js/topologia.js — Portal Clientes
document.addEventListener('DOMContentLoaded', async () => {
  const { apiFetch, getUser, logout, showToast, requireAuth } = window.auth;
  requireAuth();
  
  const user = getUser();
  if (!user) return;
  document.getElementById('user-name').textContent = user.nombre;
  document.getElementById('user-avatar').textContent = user.nombre[0].toUpperCase();
  document.getElementById('empresa-nombre').textContent = user.cliente?.empresa || (user.rol === 'admin' ? 'Vista Admin' : 'Mi Empresa');
  document.getElementById('logout-btn').addEventListener('click', e => { e.preventDefault(); logout(); });

  const treeRoot = document.getElementById('tree-root');

  async function cargarTopologia() {
    try {
      const res = await apiFetch('/topologia/arbol'); // Sin parámetro usa el cliente logueado
      const data = res.arbol;

      if (!data.sitios.length) {
        treeRoot.innerHTML = `
          <div class="tree-container">
            <div class="tree-org">🏢 ${data.organizacion.empresa}</div>
            <div style="padding: 20px; text-align:center; color:var(--text-muted); font-size:14px;">Tu organización aún no tiene sitios de red registrados.</div>
          </div>
        `;
        return;
      }

      let html = `<div class="tree-container"><div class="tree-org">🏢 ${data.organizacion.empresa}</div>`;
      
      data.sitios.forEach(sitio => {
        html += `
          <div class="tree-node-sitio">
            <div class="sitio-header">
              <div>
                <div class="sitio-title">📍 ${sitio.nombre}</div>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${sitio.direccion || 'Sin dirección registrada'}</div>
              </div>
            </div>
            
            <div class="tree-areas">
              ${sitio.areas.map(a => `
                <div class="area-card">
                  <div class="area-info">
                    <span class="a-tipo">${a.tipo}</span>
                    <div class="a-nombre">${a.nombre}</div>
                  </div>
                  <div style="font-size:16px; opacity:0.5;">🔌</div>
                </div>
              `).join('')}
              ${sitio.areas.length === 0 ? '<span style="font-size:13px; color:var(--text-muted); padding: 10px;">Sin áreas configuradas.</span>' : ''}
            </div>
          </div>
        `;
      });
      html += `</div>`;
      treeRoot.innerHTML = html;
    } catch (err) { showToast('Error cargando topología', 'error'); }
  }

  document.getElementById('refresh-btn').addEventListener('click', cargarTopologia);
  cargarTopologia();
});
