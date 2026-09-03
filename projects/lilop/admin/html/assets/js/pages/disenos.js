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
let rowsState = [];
let nextRowId = 0;

function newRow(prefill = {}) {
  return { id: nextRowId++, nombre: prefill.nombre || '', file: null, existingImagen: prefill.imagen || null };
}

function rowPreviewSrc(row) {
  if (row.file) return URL.createObjectURL(row.file);
  if (row.existingImagen) return `https://api.lilop.store${row.existingImagen}`;
  return '';
}

function rowTemplate(row, canRemove) {
  const preview = rowPreviewSrc(row);
  return `
    <div class="diseno-row" data-id="${row.id}" style="border:1px solid var(--color-border);padding:12px;border-radius:8px;margin-bottom:10px;position:relative;">
      ${canRemove ? `<button type="button" class="btn btn--ghost btn--sm" data-remove-row="${row.id}" style="position:absolute;top:6px;right:6px;">&times;</button>` : ''}
      <label class="form-label">Nombre del diseño</label>
      <input class="form-input diseno-row__nombre" data-id="${row.id}" placeholder="Ej: Flores rosadas (opcional)" value="${row.nombre}"/>
      <label class="form-label" style="margin-top:8px;">Imagen</label>
      <input type="file" class="form-input diseno-row__imagen" data-id="${row.id}" accept="image/jpeg,image/png,image/webp" multiple/>
      <span class="text-xs text-muted">JPG, PNG o WebP — máximo 5MB. Puedes seleccionar varias imágenes a la vez para crear un diseño por cada una.</span>
      <img class="diseno-row__preview ${preview ? '' : 'd-none'}" src="${preview}" style="width:100%;max-height:150px;object-fit:cover;margin-top:8px;border-radius:6px;border:1px solid var(--color-border);" alt="Preview"/>
    </div>`;
}

function renderRows() {
  const container = document.getElementById('dDisenosRows');
  container.innerHTML = rowsState.map(r => rowTemplate(r, rowsState.length > 1)).join('');
}

function resetRows(prefillDiseno) {
  rowsState = [newRow(prefillDiseno ? { nombre: prefillDiseno.nombre, imagen: prefillDiseno.imagen } : {})];
  renderRows();
}

function addRow() {
  rowsState.push(newRow());
  renderRows();
}

function removeRow(id) {
  rowsState = rowsState.filter(r => r.id !== Number(id));
  renderRows();
}

function handleFileSelect(rowId, fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const row = rowsState.find(r => r.id === Number(rowId));
  if (!row) return;
  row.file = files[0];
  row.existingImagen = null;
  for (let i = 1; i < files.length; i++) {
    rowsState.push({ id: nextRowId++, nombre: '', file: files[i], existingImagen: null });
  }
  renderRows();
}

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
        <p class="text-xs text-muted" style="margin-bottom:2px">${formatMesAnio(d.created_at)}</p>
        <p class="text-xs font-semibold mb-3" style="color:${estadoColor}">${d.estado}</p>
        <div class="diseno-card__actions">
          <button class="btn btn--outline btn--sm flex-1" data-action="edit" data-id="${d.id}">Editar</button>
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
  document.getElementById('dCatalogo').value = d?.catalogo || 'adulto_diseno';
  document.getElementById('dEstado').value    = d?.estado    || 'Disponible';

  document.getElementById('dAddRowGroup').style.display = editingId ? 'none' : '';
  resetRows(d);

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
      .map(p => {
        const thumb = p.disenos?.[0]?.imagen ? `https://api.lilop.store${p.disenos[0].imagen}` : null;
        const checked = productosSeleccionados.includes(p.id);
        return `
        <label class="prod-thumb-check">
          <input type="checkbox" value="${p.id}" ${checked ? 'checked' : ''} hidden/>
          <div class="prod-thumb-check__img">
            ${thumb
              ? `<img src="${thumb}" alt="${p.nombre}" loading="lazy"/>`
              : `<div class="prod-thumb-check__no-img"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>`}
          </div>
          <span class="prod-thumb-check__name">${p.nombre}</span>
        </label>`;
      }).join('');
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

  document.getElementById('dDisenosRows')?.addEventListener('change', e => {
    if (e.target.classList.contains('diseno-row__imagen')) {
      handleFileSelect(e.target.dataset.id, e.target.files);
    }
  });

  document.getElementById('dDisenosRows')?.addEventListener('input', e => {
    if (e.target.classList.contains('diseno-row__nombre')) {
      const row = rowsState.find(r => r.id === Number(e.target.dataset.id));
      if (row) row.nombre = e.target.value;
    }
  });

  document.getElementById('dDisenosRows')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-row]');
    if (btn) removeRow(btn.dataset.removeRow);
  });

  document.getElementById('btnAddDisenoRow')?.addEventListener('click', addRow);

  document.getElementById('btnGuardarDiseno')?.addEventListener('click', async () => {
    const catalogo = document.getElementById('dCatalogo')?.value;
    const estado    = document.getElementById('dEstado')?.value;
    const checks = document.querySelectorAll('#dProductosChecks input[type=checkbox]:checked');
    const catalogo_ids = [...checks].map(c => c.value);
    try {
      if (editingId) {
        const row = rowsState[0];
        let imagenUrl = row.existingImagen;
        if (row.file) {
          window.AdminToast?.info?.('Subiendo imagen...');
          imagenUrl = (await uploadImagen(row.file)).url;
        }
        await api.put(`/disenos/${editingId}`, { nombre: row.nombre.trim() || null, catalogo, estado, imagen: imagenUrl });
        await api.put(`/disenos/${editingId}/productos`, { catalogo_ids });
        window.AdminToast?.success('Diseño actualizado');
      } else {
        window.AdminToast?.info?.(`Guardando ${rowsState.length} diseño${rowsState.length !== 1 ? 's' : ''}...`);
        for (const row of rowsState) {
          let imagenUrl = null;
          if (row.file) imagenUrl = (await uploadImagen(row.file)).url;
          const nuevo = await api.post('/disenos', { nombre: row.nombre.trim() || undefined, catalogo, estado, imagen: imagenUrl });
          if (catalogo_ids.length) await api.put(`/disenos/${nuevo.id}/productos`, { catalogo_ids });
        }
        window.AdminToast?.success(`${rowsState.length} diseño${rowsState.length !== 1 ? 's' : ''} agregado${rowsState.length !== 1 ? 's' : ''}`);
      }

      window.AdminModal.close('modalDiseno');
      await loadData();
      if (window.opener && !window.opener.closed) {
        try {
          window.close();
          setTimeout(() => { window.location.href = '/disenos.html'; }, 300);
        } catch { window.location.href = '/disenos.html'; }
      }
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
