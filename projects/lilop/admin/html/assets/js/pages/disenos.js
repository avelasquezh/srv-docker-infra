'use strict';

const session = window.AdminAuth.guard();
if (!session) throw new Error('No auth');
window.AdminLayout.init('Diseños');

const api = window.AdminApi;

const COL_LABELS = {
  adulto_diseno:   'Adulto — Diseño',
  adulto_unicolor: 'Adulto — Unicolor',
  nino:            'Niño',
  nina:            'Niña',
};

let allDisenos = [];
let filtered   = [];
let editingId  = null;
let catalogoProds = [];

function formatMesAnio(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function renderGrid() {
  const grid = document.getElementById('disenosGrid');
  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <p class="empty-state__title">Sin diseños</p>
        <p class="empty-state__desc">Agrega tus primeros diseños al catálogo</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(d => {
    const estadoColor = d.estado === 'Disponible'
      ? 'var(--color-success, #16a34a)'
      : 'var(--color-error, #dc2626)';
    const imgSrc = d.imagen
      ? `https://api.lilop.store${d.imagen}`
      : null;

    return `
    <div class="diseno-card">
      <div class="diseno-card__img">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${d.nombre}" loading="lazy" data-lightbox="${imgSrc}" style="cursor:zoom-in;"/>`
          : `<div class="diseno-card__no-img">
               <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-lilac)" stroke-width="1.5">
                 <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
               </svg>
             </div>`}
      </div>
      <div class="diseno-card__info">
        <p class="diseno-card__name">${d.nombre}</p>
        <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:2px;">${formatMesAnio(d.created_at)}</p>
        <p style="font-size:var(--text-xs);font-weight:var(--weight-semibold);color:${estadoColor};margin-bottom:var(--s-3);">${d.estado}</p>
        <div class="diseno-card__actions">
          <button class="btn btn--outline btn--sm" style="flex:1;" data-action="edit" data-id="${d.id}">Editar</button>
          <button class="btn btn--danger btn--sm btn--icon" data-action="delete" data-id="${d.id}" data-nombre="${d.nombre}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-action="edit"]').forEach(btn =>
    btn.addEventListener('click', () => openModal(btn.dataset.id))
  );
  grid.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id, btn.dataset.nombre))
  );
}

function applyFilters() {
  const q   = document.getElementById('searchDisenos')?.value.toLowerCase().trim() || '';
  const col = document.getElementById('filterCatalogo')?.value || '';
  const est = document.getElementById('filterEstado')?.value || '';
  filtered = allDisenos.filter(d =>
    (!q   || d.nombre?.toLowerCase().includes(q)) &&
    (!col || d.catalogo === col) &&
    (!est || d.estado === est)
  );
  renderGrid();
  document.getElementById('disenosCount').textContent =
    `${filtered.length} diseño${filtered.length !== 1 ? 's' : ''}`;
  window.AdminFilterTags.update();
}

async function openModal(id) {
  const d = id ? allDisenos.find(x => x.id === id) : null;
  editingId = id || null;
  document.getElementById('modalDisenoTitle').textContent = d ? 'Editar diseño' : 'Agregar diseño';
  document.getElementById('dNombre').value    = d?.nombre    || '';
  document.getElementById('dCatalogo').value = d?.catalogo || 'adulto_diseno';
  document.getElementById('dEstado').value    = d?.estado    || 'Disponible';

  const fileInput = document.getElementById('dImagenFile');
  if (fileInput) fileInput.value = '';

  // Cargar checkboxes de tipos de producto
  const checksContainer = document.getElementById('dProductosChecks');
  if (checksContainer) {
    let productosSeleccionados = [];
    if (editingId) {
      try {
        const prods = await api.get(`/disenos/${editingId}/productos`);
        productosSeleccionados = prods.map(p => p.id);
      } catch {}
    }
    checksContainer.innerHTML = catalogoProds
      .filter(p => p.activo)
      .map(p => `
        <label style="display:flex;align-items:center;gap:var(--s-2);font-size:var(--text-sm);cursor:pointer;white-space:nowrap;">
          <input type="checkbox" value="${p.id}" ${productosSeleccionados.includes(p.id) ? 'checked' : ''}
            style="width:15px;height:15px;accent-color:var(--color-violet);cursor:pointer;"/>
          ${p.nombre}
        </label>`).join('');
  }

  const prev = document.getElementById('dPreview');
  const img  = document.getElementById('dPreviewImg');
  if (d?.imagen) {
    img.src = `https://api.lilop.store${d.imagen}`;
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
  window.AdminModal.open('modalDiseno');
}

function confirmDelete(id, nombre) {
  window.AdminConfirm.show(
    `¿Eliminar el diseño <strong>${nombre}</strong>? Esta acción no se puede deshacer.`,
    async () => {
      try {
        await api.delete(`/disenos/${id}`);
        window.AdminToast?.success('Diseño eliminado');
        await loadData();
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    }
  );
}

async function uploadImagen(file) {
  const form = new FormData();
  form.append('imagen', file);
  const token = JSON.parse(localStorage.getItem('lilop_admin_session'))?.token;
  const res = await fetch('https://api.lilop.store/api/imagenes/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status} al subir imagen`);
  }
  return res.json();
}

async function loadData() {
  try {
    const producto = document.getElementById('filterProducto')?.value || '';
    const disenosUrl = producto ? `/disenos?catalogo_id=${producto}` : '/disenos';
    [allDisenos, catalogoProds] = await Promise.all([
      api.get(disenosUrl),
      api.get('/catalogo'),
    ]);
    const sel = document.getElementById('filterProducto');
    if (sel) {
      const valActual = sel.value;
      sel.innerHTML = '<option value="">Todos los productos</option>';
      catalogoProds.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        sel.appendChild(opt);
      });
      sel.value = valActual;
    }
    applyFilters();
  } catch (err) {
    window.AdminToast?.error('Error', 'No se pudieron cargar los diseños');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.AdminAuth.populateUserInfo(session);

  window.AdminFilterTags.init({
    filters: [
      { id: 'searchDisenos',  label: 'Búsqueda',  type: 'search' },
      { id: 'filterProducto', label: 'Producto',  type: 'select' },
      { id: 'filterCatalogo', label: 'Catálogo',  type: 'select' },
      { id: 'filterEstado',   label: 'Estado',    type: 'select' },
    ],
    containerId: 'activeFilters',
    onClear: applyFilters,
  });

  loadData();

  document.getElementById('dImagenFile')?.addEventListener('change', e => {
    const file = e.target.files[0];
    const prev = document.getElementById('dPreview');
    const img  = document.getElementById('dPreviewImg');
    if (file) {
      img.src = URL.createObjectURL(file);
      prev.style.display = 'block';
    } else {
      prev.style.display = 'none';
    }
  });

  document.getElementById('btnGuardarDiseno')?.addEventListener('click', async () => {
    const nombre = document.getElementById('dNombre')?.value.trim();
    if (!nombre) {
      window.AdminToast?.error('Campo requerido', 'El nombre es obligatorio');
      return;
    }

    const fileInput = document.getElementById('dImagenFile');
    const file = fileInput?.files[0];
    let imagenUrl = editingId
      ? allDisenos.find(x => x.id === editingId)?.imagen || null
      : null;

    try {
      if (file) {
        window.AdminToast?.info?.('Subiendo imagen...');
        const resultado = await uploadImagen(file);
        imagenUrl = resultado.url;
      }

      const data = {
        nombre,
        catalogo: document.getElementById('dCatalogo')?.value,
        estado:    document.getElementById('dEstado')?.value,
        imagen:    imagenUrl,
      };

      let disenoId = editingId;
      if (editingId) {
        await api.put(`/disenos/${editingId}`, data);
        window.AdminToast?.success('Diseño actualizado');
      } else {
        const nuevo = await api.post('/disenos', data);
        disenoId = nuevo.id;
        window.AdminToast?.success('Diseño agregado');
      }
      const checks = document.querySelectorAll('#dProductosChecks input[type=checkbox]:checked');
      const catalogo_ids = [...checks].map(c => c.value);
      if (disenoId) await api.put(`/disenos/${disenoId}/productos`, { catalogo_ids });

      window.AdminModal.close('modalDiseno');
      await loadData();
    } catch (err) {
      window.AdminToast?.error('Error', err.message);
    }
  });

  let t;
  document.getElementById('searchDisenos')?.addEventListener('input', () => {
    clearTimeout(t); t = setTimeout(applyFilters, 300);
  });
  document.getElementById('filterProducto')?.addEventListener('change', loadData);
  document.getElementById('filterCatalogo')?.addEventListener('change', applyFilters);
  document.getElementById('filterEstado')?.addEventListener('change', applyFilters);
  document.getElementById('btnNuevoDiseno')?.addEventListener('click', () => openModal(null));

  /* ── Lightbox ── */
  window.AdminLightbox.init();
  document.getElementById('disenosGrid').addEventListener('click', e => {
    const img = e.target.closest('[data-lightbox]');
    if (img) window.AdminLightbox.open(img.dataset.lightbox);
  });
});
