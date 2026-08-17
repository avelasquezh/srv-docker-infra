/* ============================================================
   Lilop Admin — pages/productos.js
   ============================================================ */

'use strict';

const session = window.AdminAuth.guard();
if (!session) throw new Error('No auth');
window.AdminLayout.init('Productos');

const store = window.AdminStore;
let allProductos = [];
let filtered = [];
let currentPage = 1;
const PER_PAGE = 12;
let editingId = null;

const CATEGORIAS = {
  sabanas: 'Sábanas', edredones: 'Edredones', almohadas: 'Almohadas',
  cubrecamas: 'Cubrecamas', fundas: 'Fundas', toallas: 'Toallas',
  protectores: 'Protectores', decoracion: 'Decoración',
};

/* ─── RENDER GRID ─────────────────────────────────────────── */
function renderGrid() {
  const grid  = document.getElementById('productosGrid');
  const start = (currentPage - 1) * PER_PAGE;
  const page  = filtered.slice(start, start + PER_PAGE);

  if (!page.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>
        <p class="empty-state__title">Sin productos</p>
        <p class="empty-state__desc">Agrega tu primer producto al catálogo</p>
      </div>`;
    return;
  }

  grid.innerHTML = page.map(p => `
    <div class="admin-panel d-flex flex-col">
      <div class="pos-relative" style="height:160px;background:var(--color-fog);border-radius:var(--r-lg) var(--r-lg) 0 0;overflow:hidden">
        ${p.imagen
          ? `<img src="${p.imagen}" style="width:100%;height:100%;object-fit:cover;" alt="${p.nombre}" loading="lazy"/>`
          : `<div class="d-flex items-center justify-center" style="width:100%;height:100%"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-lilac)" stroke-width="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>`
        }
        <span class="status-badge ${p.estado === 'active' ? 'status-badge--active' : 'status-badge--inactive'} pos-absolute" style="top:10px;right:10px">${p.estado === 'active' ? 'Activo' : 'Inactivo'}</span>
      </div>
      <div class="p-5 flex-1 d-flex flex-col gap-2">
        <p class="text-xs font-semibold uppercase text-violet" style="letter-spacing:0.1em">${CATEGORIAS[p.categoria] || p.categoria}</p>
        <h3 class="font-display text-base font-semibold" style="line-height:var(--leading-snug)">${p.nombre}</h3>
        <div class="d-flex items-center justify-between" style="margin-top:auto;padding-top:var(--s-3);border-top:1px solid var(--color-border)">
          <span class="font-display text-lg font-bold text-violet">${store.formatPrice(p.precio)}</span>
          <span class="text-xs text-muted">${p.vendidos || 0} vendidos</span>
        </div>
      </div>
      <div class="d-flex gap-2" style="padding:0 var(--s-5) var(--s-5)">
        <button class="btn btn--outline btn--sm flex-1" data-action="edit" data-id="${p.id}">Editar</button>
        <button class="btn btn--danger btn--sm btn--icon" data-action="toggle" data-id="${p.id}" aria-label="${p.estado === 'active' ? 'Desactivar' : 'Activar'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p.estado === 'active' ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>' : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'}
          </svg>
        </button>
        <button class="btn btn--danger btn--sm btn--icon" data-action="delete" data-id="${p.id}" aria-label="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.id)));
  grid.querySelectorAll('[data-action="toggle"]').forEach(btn => btn.addEventListener('click', () => toggleEstado(btn.dataset.id)));
  grid.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => confirmDelete(btn.dataset.id)));
}

/* ─── PAGINACIÓN ──────────────────────────────────────────── */
function renderPagination() {
  const total = Math.ceil(filtered.length / PER_PAGE);
  const el    = document.getElementById('productosPagination');
  if (!el) return;
  const start = (currentPage - 1) * PER_PAGE + 1;
  const end   = Math.min(currentPage * PER_PAGE, filtered.length);
  el.innerHTML = `
    <span>${start}–${end} de ${filtered.length} productos</span>
    <div class="pagination__btns">
      <button class="pagination__btn" ${currentPage === 1 ? 'disabled' : ''} id="prevP"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
      ${Array.from({ length: total }, (_, i) => `<button class="pagination__btn ${i+1===currentPage?'is-active':''}" data-page="${i+1}">${i+1}</button>`).join('')}
      <button class="pagination__btn" ${currentPage === total ? 'disabled' : ''} id="nextP"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div>`;
  document.getElementById('prevP')?.addEventListener('click', () => { currentPage--; renderGrid(); renderPagination(); });
  document.getElementById('nextP')?.addEventListener('click', () => { currentPage++; renderGrid(); renderPagination(); });
  el.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { currentPage = parseInt(b.dataset.page); renderGrid(); renderPagination(); }));
}

/* ─── MODAL ───────────────────────────────────────────────── */
function openModal(id) {
  const p = id ? allProductos.find(x => x.id === id) : null;
  editingId = id || null;
  document.getElementById('modalProductoTitle').textContent = p ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('modalProductoBody').innerHTML = `
    <div class="form-group">
      <label class="form-label form-label--required">Nombre</label>
      <input class="form-input" id="pNombre" value="${p?.nombre || ''}"/>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label form-label--required">Categoría</label>
        <select class="form-input" id="pCategoria">
          ${Object.entries(CATEGORIAS).map(([k,v]) => `<option value="${k}" ${p?.categoria===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label form-label--required">Precio (COP)</label>
        <input class="form-input" id="pPrecio" type="number" value="${p?.precio || ''}"/>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción corta</label>
      <textarea class="form-input" id="pDesc" style="height:70px;">${p?.shortDescription || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">URL de imagen principal</label>
      <input class="form-input" id="pImagen" placeholder="https://... o /assets/img/productos/..." value="${p?.imagen || p?.images?.[0] || ''}"/>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-input" id="pEstado">
          <option value="active" ${(!p || p.estado==='active')?'selected':''}>Activo</option>
          <option value="inactive" ${p?.estado==='inactive'?'selected':''}>Inactivo</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Destacado en home</label>
        <select class="form-input" id="pFeatured">
          <option value="true" ${p?.featured?'selected':''}>Sí</option>
          <option value="false" ${!p?.featured?'selected':''}>No</option>
        </select>
      </div>
    </div>
  `;
  window.AdminModal.open('modalProducto');
}

document.getElementById('btnGuardarProducto')?.addEventListener('click', () => {
  const nombre = document.getElementById('pNombre')?.value.trim();
  const precio = parseFloat(document.getElementById('pPrecio')?.value);
  if (!nombre) { window.AdminToast.error('Campo requerido', 'El nombre es obligatorio'); return; }
  if (!precio)  { window.AdminToast.error('Campo requerido', 'El precio es obligatorio'); return; }

  const data = {
    nombre,
    categoria:        document.getElementById('pCategoria')?.value,
    categoryLabel:    CATEGORIAS[document.getElementById('pCategoria')?.value],
    precio,
    shortDescription: document.getElementById('pDesc')?.value.trim(),
    imagen:           document.getElementById('pImagen')?.value.trim(),
    estado:           document.getElementById('pEstado')?.value,
    featured:         document.getElementById('pFeatured')?.value === 'true',
  };

  if (editingId) {
    store.updateProducto(editingId, data);
    window.AdminToast.success('Producto actualizado');
  } else {
    store.addProducto({ ...data, vendidos: 0 });
    window.AdminToast.success('Producto creado');
  }

  window.AdminModal.close('modalProducto');
  loadData();
});

function toggleEstado(id) {
  const p = allProductos.find(x => x.id === id);
  if (!p) return;
  store.updateProducto(id, { estado: p.estado === 'active' ? 'inactive' : 'active' });
  loadData();
  window.AdminToast.info(`Producto ${p.estado === 'active' ? 'desactivado' : 'activado'}`);
}

function confirmDelete(id) {
  const p = allProductos.find(x => x.id === id);
  window.AdminConfirm.show(`¿Eliminar <strong>${p?.nombre}</strong>?`, () => {
    store.deleteProducto(id);
    loadData();
    window.AdminToast.success('Producto eliminado');
  });
}

/* ─── FILTROS ─────────────────────────────────────────────── */
function applyFilters() {
  const q   = document.getElementById('searchProductos')?.value.toLowerCase().trim() || '';
  const cat = document.getElementById('filterCategoria')?.value || '';
  const est = document.getElementById('filterEstadoP')?.value || '';
  filtered = allProductos.filter(p =>
    (!q   || p.nombre.toLowerCase().includes(q)) &&
    (!cat || p.categoria === cat) &&
    (!est || p.estado === est)
  );
  currentPage = 1;
  renderGrid();
  renderPagination();
  document.getElementById('productosCount').textContent = `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`;
}

function loadData() {
  allProductos = store.getProductos();
  applyFilters();
}

document.addEventListener('DOMContentLoaded', () => {
  window.AdminAuth.populateUserInfo(session);
  loadData();
  let t;
  document.getElementById('searchProductos')?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(applyFilters, 300); });
  document.getElementById('filterCategoria')?.addEventListener('change', applyFilters);
  document.getElementById('filterEstadoP')?.addEventListener('change', applyFilters);
  document.getElementById('btnNuevoProducto')?.addEventListener('click', () => openModal(null));
});
