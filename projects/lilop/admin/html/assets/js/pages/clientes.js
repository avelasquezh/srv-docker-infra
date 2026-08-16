/* ============================================================
   Lilop Admin — pages/clientes.js
   Lista de clientes. Consume la API REST.
   Campos reales: id, nombre, celular, ciudad, origen_venta,
                  created_at, total_pedidos, total_gastado
   ============================================================ */
'use strict';

const session = window.AdminAuth.guard();
if (!session) throw new Error('No auth');

window.AdminLayout.init('Clientes');

const api = window.AdminApi;

let allClientes = [];
let filtered    = [];
let currentPage = 1;
const PER_PAGE  = 10;
let editingId   = null;
let sortCol     = 'created_at';
let sortDir     = 'desc';

/* ── Formatters ── */
function formatPrice(n) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(n || 0);
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/* ── Render tabla ── */
function renderTable() {
  const tbody = document.getElementById('clientesBody');
  const page  = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  if (!page.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <p class="empty-state__title">Sin clientes</p>
          <p class="empty-state__desc">No hay clientes registrados aún</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = page.map(c => `
    <tr>
      <td>
        <a href="/cliente.html?id=${c.id}" style="display:flex;align-items:center;gap:var(--s-3);text-decoration:none;color:inherit;border-radius:var(--r-md);padding:var(--s-1);margin:-var(--s-1);transition:background var(--duration-fast);"
          onmouseover="this.style.background='var(--color-soft)'"
          onmouseout="this.style.background='transparent'">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;color:white;font-size:var(--text-sm);flex-shrink:0;">
            ${c.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style="font-size:var(--text-sm);font-weight:600;color:var(--color-text);">${c.nombre}</p>
            <p style="font-size:var(--text-xs);color:var(--color-text-muted);">${c.origen_venta || '—'}</p>
          </div>
        </a>
      </td>
      <td data-label="Teléfono" style="font-size:var(--text-sm);">${c.celular || '—'}</td>
      <td data-label="Ciudad" style="font-size:var(--text-sm);color:var(--color-text-muted);">${c.ciudad || '—'}</td>
      <td data-label="Pedidos" style="text-align:center;font-weight:600;">${c.total_pedidos || 0}</td>
      <td data-label="Valor pedidos" style="font-weight:600;color:var(--color-violet);">${formatPrice(c.total_gastado || 0)}</td>
      <td data-label="Registrado" style="font-size:var(--text-xs);color:var(--color-text-muted);">${formatDate(c.created_at)}</td>
      <td>
        <div style="display:flex;gap:var(--s-2);">
          <button class="btn btn--sm btn--outline btn--icon" data-action="edit" data-id="${c.id}" aria-label="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn--sm btn--danger btn--icon" data-action="delete" data-id="${c.id}" data-nombre="${c.nombre}" aria-label="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn =>
    btn.addEventListener('click', () => openModal(btn.dataset.id))
  );
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id, btn.dataset.nombre))
  );
}

/* ── Paginación ── */
function renderPagination() {
  const total = Math.ceil(filtered.length / PER_PAGE);
  const el    = document.getElementById('clientesPagination');
  if (!el) return;

  const s = (currentPage - 1) * PER_PAGE + 1;
  const e = Math.min(currentPage * PER_PAGE, filtered.length);

  el.innerHTML = `
    <span>${s}–${e} de ${filtered.length}</span>
    <div class="pagination__btns">
      <button class="pagination__btn" ${currentPage === 1 ? 'disabled' : ''} id="prevC">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      ${Array.from({ length: total }, (_, i) => `
        <button class="pagination__btn ${i + 1 === currentPage ? 'is-active' : ''}" data-page="${i + 1}">${i + 1}</button>
      `).join('')}
      <button class="pagination__btn" ${currentPage === total ? 'disabled' : ''} id="nextC">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>`;

  document.getElementById('prevC')?.addEventListener('click', () => { currentPage--; renderTable(); renderPagination(); });
  document.getElementById('nextC')?.addEventListener('click', () => { currentPage++; renderTable(); renderPagination(); });
  el.querySelectorAll('[data-page]').forEach(b =>
    b.addEventListener('click', () => { currentPage = parseInt(b.dataset.page); renderTable(); renderPagination(); })
  );
}

/* ── Filtros ── */
function sortData() {
  filtered.sort((a, b) => {
    let va = a[sortCol] ?? '';
    let vb = b[sortCol] ?? '';
    if (['total_pedidos','total_gastado'].includes(sortCol)) {
      va = parseFloat(va) || 0;
      vb = parseFloat(vb) || 0;
    } else if (sortCol === 'created_at') {
      va = va ? new Date(va).getTime() : 0;
      vb = vb ? new Date(vb).getTime() : 0;
    } else {
      va = va.toString().toLowerCase();
      vb = vb.toString().toLowerCase();
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });
}

function updateSortIcons() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    if (th.dataset.sort === sortCol) {
      icon.textContent = sortDir === 'asc' ? '↑' : '↓';
      th.style.color = 'var(--color-violet)';
    } else {
      icon.textContent = '↕';
      th.style.color = '';
    }
  });
}

function applyFilters() {
  const q = document.getElementById('searchClientes')?.value.toLowerCase().trim() || '';
  filtered = allClientes.filter(c =>
    !q ||
    c.nombre?.toLowerCase().includes(q) ||
    c.celular?.includes(q) ||
    c.ciudad?.toLowerCase().includes(q)
  );
  sortData();
  currentPage = 1;
  renderTable();
  renderPagination();
  updateSortIcons();
  document.getElementById('clientesCount').textContent =
    `${filtered.length} cliente${filtered.length !== 1 ? 's' : ''}`;
  window.AdminFilterTags.update();
}

/* ── Modal nuevo / editar ── */
function openModal(id) {
  const c = id ? allClientes.find(x => x.id === id) : null;
  editingId = id || null;
  document.getElementById('modalClienteTitle').textContent = c ? 'Editar cliente' : 'Nuevo cliente';
  document.getElementById('modalClienteBody').innerHTML = window.renderFormCliente(c);
  window.initFormCliente(c);
  api.get('/clientes/listas/origenes').then(origenes => {
    window.poblarOrigenes(origenes, c?.origen_venta || null);
  }).catch(() => {});
  window.AdminModal.open('modalCliente');
}



/* ── Eliminar ── */
function confirmDelete(id, nombre) {
  window.AdminConfirm.show(
    `¿Eliminar a <strong>${nombre}</strong>? Esta acción no se puede deshacer.`,
    async () => {
      try {
        await api.delete(`/clientes/${id}`);
        window.AdminToast?.success('Cliente eliminado');
        await loadData();
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    }
  );
}

/* ── Cargar datos ── */
async function loadData() {
  try {
    allClientes = await api.get('/clientes');
    applyFilters();


  } catch (err) {
    window.AdminToast?.error('Error', 'No se pudieron cargar los clientes');
  }
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  window.AdminAuth.populateUserInfo(session);

  window.AdminFilterTags.init({
    filters: [
      { id: 'searchClientes', label: 'Búsqueda', type: 'search' },
    ],
    containerId: 'activeFilters',
    onClear: applyFilters,
  });

  loadData();

  document.getElementById('btnGuardarCliente')?.addEventListener('click', async () => {
    console.log('click guardar');
    if (!window.validarFormCliente()) return;
    const data = window.recolectarFormCliente();
    try {
      if (editingId) {
        await api.put(`/clientes/${editingId}`, data);
        window.AdminToast?.success('Cliente actualizado');
      } else {
        await api.post('/clientes', data);
        window.AdminToast?.success('Cliente creado');
      }
      window.AdminModal.close('modalCliente');
      await loadData();
    } catch (err) {
      window.AdminToast?.error('Error', err.message);
    }
  });
  let searchTimer;
  document.getElementById('searchClientes')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 300);
  });
  document.getElementById('btnNuevoCliente')?.addEventListener('click', () => openModal(null));

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      if (sortCol === th.dataset.sort) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = th.dataset.sort;
        sortDir = 'asc';
      }
      sortData();
      renderTable();
      renderPagination();
      updateSortIcons();
    });
  });
});
