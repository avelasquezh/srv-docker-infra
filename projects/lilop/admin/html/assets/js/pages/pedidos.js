/* ============================================================
   Lilop Admin — pages/pedidos.js
   Lista de pedidos. Consume la API REST.
   ============================================================ */
'use strict';

const session = window.AdminAuth.guard();
if (!session) throw new Error('No auth');

window.AdminLayout.init('Pedidos');

const api = window.AdminApi;
let vendedores = [];

const ESTADO_CONFIG = {
  por_confirmar:   { label: 'Por confirmar',   cls: 'status-badge--pending'    },
  en_alistamiento: { label: 'En alistamiento', cls: 'status-badge--processing' },
  por_entregar:    { label: 'Por entregar',    cls: 'status-badge--shipped'    },
  entregado:       { label: 'Entregado',       cls: 'status-badge--delivered'  },
  cancelado:       { label: 'Cancelado',       cls: 'status-badge--cancelled'  },
};

let allPedidos  = [];
let filtered    = [];
let currentPage = 1;
const PER_PAGE  = 10;
let sortCol     = 'fecha_venta';
let sortDir     = 'desc';

function formatPrice(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
}
function formatDate(iso) {
  if (!iso) return '—';
  const d = iso.length === 10
    ? new Date(iso + 'T12:00:00')
    : new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── RENDER TABLA ────────────────────────────────────────── */
function renderTable() {
  const tbody = document.getElementById('pedidosBody');
  const page  = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  if (!page.length) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/>
            </svg>
          </div>
          <p class="empty-state__title">Sin pedidos</p>
          <p class="empty-state__desc">No hay pedidos que coincidan con los filtros</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = page.map(p => {
    const est = ESTADO_CONFIG[p.estado] || { label: p.estado, cls: '' };
    return `
      <tr>
        <td>
          <a class="d-flex items-center gap-3 text-inherit radius-md p-1" href="/cliente.html?id=${p.cliente_id || ''}" style="text-decoration:none;margin:-4px;transition:background var(--duration-fast)" onmouseover="this.style.background='var(--color-soft)'" onmouseout="this.style.background='transparent'">
            <div class="d-flex items-center justify-center font-display font-bold text-white text-xs shrink-0" style="width:32px;height:32px;border-radius:50%;background:var(--grad-primary)">
              ${(p.cliente || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p class="text-sm font-semibold text-ink">${p.cliente || '—'}</p>
              <p class="text-xs text-muted">${p.cliente_cel || ''}</p>
            </div>
          </a>
        </td>
        <td class="text-xs text-muted">${p.vendedor || '—'}</td>
        <td class="font-semibold text-violet">${formatPrice(p.valor_venta)}</td>
        <td class="text-xs text-muted">${p.medio_pago || '—'}</td>
        <td>
          <select class="form-input text-xs" data-pedido-id="${p.id}" data-action="cambiar-estado" style="padding:5px 28px 5px 8px;height:auto;min-width:110px">
            ${Object.entries(ESTADO_CONFIG).map(([val, cfg]) =>
              `<option value="${val}" ${p.estado === val ? 'selected' : ''}>${cfg.label}</option>`
            ).join('')}
          </select>
        </td>
        <td class="text-xs text-muted">${formatDate(p.fecha_venta)}</td>
        <td class="text-xs" style="color:${p.fecha_entrega ? 'var(--color-violet)' : 'var(--color-text-light)'}">${formatDate(p.fecha_entrega) || '—'}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn--sm btn--outline btn--icon" data-action="edit" data-id="${p.id}" aria-label="Editar pedido">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn--sm btn--outline btn--icon" data-action="costos" data-id="${p.id}" aria-label="Costos del pedido" style="color:#b8860b;border-color:#b8860b;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </button>
            <button class="btn btn--sm btn--danger btn--icon" data-action="delete" data-id="${p.id}" data-num="${p.id}" aria-label="Eliminar pedido">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn =>
    btn.addEventListener('click', () => abrirModalEditar(btn.dataset.id))
  );
  tbody.querySelectorAll('[data-action="costos"]').forEach(btn =>
    btn.addEventListener('click', () => abrirModalCostosPedido(btn.dataset.id))
  );
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id, btn.dataset.num))
  );
  tbody.querySelectorAll('[data-action="cambiar-estado"]').forEach(sel => {
    sel.addEventListener('change', async () => {
      try {
        await api.patch(`/pedidos/${sel.dataset.pedidoId}/estado`, { estado: sel.value });
        window.AdminToast?.success('Estado actualizado');
        await loadData();
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    });
  });
}

/* ─── COSTOS PEDIDO ──────────────────────────────────────── */
let pedidoCostosActivo = null;

async function abrirModalCostosPedido(pedidoId) {
  pedidoCostosActivo = pedidoId;
  document.getElementById('modalCostosPedidoTitle').textContent = `Costos — ${pedidoId}`;
  await renderModalCostosPedido();
  window.AdminModal.open('modalCostosPedido');
}

async function renderModalCostosPedido() {
  const body = document.getElementById('modalCostosPedidoBody');
  body.innerHTML = '<p class="text-center text-muted">Cargando...</p>';

  let datos = { domicilio: [], comision: [], otros: [] };
  let listaDoms = [], listaComisiones = [], listaConceptos = [];
  try {
    [datos, listaDoms, listaComisiones, listaConceptos] = await Promise.all([
      api.get(`/pedidos/${pedidoCostosActivo}/costos`),
      api.get('/auth/vendedores?rol=domiciliario'),
      api.get('/auth/vendedores?rol=vendedor'),
      api.get(`/pedidos/${pedidoCostosActivo}/costos/listas/conceptos`),
    ]);
  } catch {}

  function seccionLabel(texto) {
    return `<p class="text-xs font-semibold uppercase text-light mb-3" style="letter-spacing:0.08em">${texto}</p>`;
  }

  function filaRegistro(nombre, valor, tipo, id) {
    return `
      <div class="d-flex items-center justify-between p-2-3 radius-sm" style="background:var(--color-fog)">
        <span class="text-sm">${nombre}</span>
        <div class="d-flex items-center gap-3">
          <span class="text-sm font-semibold">${formatPrice(valor)}</span>
          <button data-costo-tipo="${tipo}" data-costo-id="${id}" data-costo-action="eliminar" class="btn btn--sm btn--danger btn--icon size-28 shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>`;
  }

  function filaNuevo(tipo, campos) {
    return `
      <div class="d-flex gap-2 mt-3 items-end">
        ${campos.map(c => `
          <div class="form-group flex-1">
            <label class="form-label ${c.required ? 'form-label--required' : ''}">${c.label}</label>
            ${c.select ? `
              <select class="form-input" id="${c.id}">
                <option value="">Selecciona…</option>
                ${(c.options || []).map(o => `<option value="${o.id || o}">${o.nombre || o}</option>`).join('')}
              </select>` : c.type === 'number' ? `
              <input class="form-input" type="number" id="${c.id}"
                value="${c.value || ''}" placeholder="${c.placeholder || '0'}" min="0"/>` : `
              <input class="form-input" id="${c.id}" placeholder="${c.placeholder || ''}"/>`}
          </div>`).join('')}
        <button data-costo-tipo="${tipo}" data-costo-action="agregar" class="btn btn--primary btn--sm shrink-0">Agregar</button>
      </div>`;
  }

  body.innerHTML = `
    <div class="d-flex flex-col gap-5">
      <div>
        ${seccionLabel('Domicilio')}
        <div class="d-flex flex-col gap-2" data-costo-lista="domicilio">
          ${datos.domicilio.map(e => filaRegistro(e.domiciliario || 'Sin nombre', e.valor_domicilio, 'domicilio', e.id)).join('')}
        </div>
        ${filaNuevo('domicilio', [
          { id: 'domNombre', label: 'Domiciliario', select: true, options: listaDoms.map(v => ({ id: v.nombre, nombre: v.nombre })), required: true },
          { id: 'domValor',  label: 'Valor', type: 'number', required: true },
        ])}
      </div>
      <div>
        ${seccionLabel('Comisión')}
        <div class="d-flex flex-col gap-2" data-costo-lista="comision">
          ${datos.comision.map(c => filaRegistro(c.nombre_vendedor || 'Sin nombre', c.valor_comision, 'comision', c.id)).join('')}
        </div>
        ${filaNuevo('comision', [
          { id: 'comNombre', label: 'Vendedor', select: true, options: listaComisiones.map(v => ({ id: v.nombre, nombre: v.nombre })), required: true },
          { id: 'comValor',  label: 'Valor', type: 'number', required: true },
        ])}
      </div>
      <div>
        ${seccionLabel('Otros')}
        <div class="d-flex flex-col gap-2" data-costo-lista="otros">
          ${datos.otros.map(o => filaRegistro(o.nombre, o.valor, 'otros', o.id)).join('')}
        </div>
        ${filaNuevo('otros', [
          { id: 'otroNombre', label: 'Concepto', select: true, options: listaConceptos.map(v => ({ id: v, nombre: v })), required: true },
          { id: 'otroValor',  label: 'Valor', type: 'number', required: true },
        ])}
      </div>
    </div>
  `;

  async function eliminarCosto(tipo, id) {
    const urls = {
      domicilio: `/pedidos/${pedidoCostosActivo}/costos/domicilio/${id}`,
      comision:  `/pedidos/${pedidoCostosActivo}/costos/comision/${id}`,
      otros:     `/pedidos/${pedidoCostosActivo}/costos/otros/${id}`,
    };
    const labels = { domicilio: 'Domicilio', comision: 'Comisión', otros: 'Costo' };
    await api.delete(urls[tipo]);
    window.AdminToast?.success(`${labels[tipo]} eliminado`);
    await renderModalCostosPedido();
    await loadData();
  }

  async function agregarCosto(tipo) {
    const handlers = {
      domicilio: async () => {
        const domNombre = document.getElementById('domNombre')?.value;
        if (!domNombre) throw new Error('Selecciona un domiciliario');
        const valor = parseFloat(document.getElementById('domValor')?.value);
        if (!valor || valor <= 0) throw new Error('Ingresa un valor válido');
        await api.post(`/pedidos/${pedidoCostosActivo}/costos/domicilio`, {
          valor_domicilio: valor,
          domiciliario: domNombre,
        });
        return 'Domicilio agregado';
      },
      comision: async () => {
        const nombre_vendedor = document.getElementById('comNombre')?.value;
        if (!nombre_vendedor) throw new Error('Selecciona un vendedor');
        const valor = parseFloat(document.getElementById('comValor')?.value);
        if (!valor || valor <= 0) throw new Error('Ingresa un valor válido');
        await api.post(`/pedidos/${pedidoCostosActivo}/costos/comision`, { valor_comision: valor, nombre_vendedor });
        return 'Comisión guardada';
      },
      otros: async () => {
        const nombre = document.getElementById('otroNombre')?.value;
        const valor  = parseFloat(document.getElementById('otroValor')?.value);
        if (!nombre) throw new Error('Ingresa un concepto');
        if (!valor || valor <= 0) throw new Error('Ingresa un valor válido');
        await api.post(`/pedidos/${pedidoCostosActivo}/costos/otros`, { nombre, valor });
        return 'Costo agregado';
      },
    };
    const msg = await handlers[tipo]();
    window.AdminToast?.success(msg);
    await renderModalCostosPedido();
    await loadData();
  }

  body.querySelectorAll('[data-costo-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.costoAction;
      const tipo   = btn.dataset.costoTipo;
      const id     = btn.dataset.costoId;
      try {
        if (action === 'eliminar') await eliminarCosto(tipo, id);
        if (action === 'agregar')  await agregarCosto(tipo);
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    });
  });
}

/* ─── PAGINACIÓN ──────────────────────────────────────────── */
function renderPagination() {
  const total = Math.ceil(filtered.length / PER_PAGE);
  const el    = document.getElementById('pedidosPagination');
  if (!el) return;

  const s = (currentPage - 1) * PER_PAGE + 1;
  const e = Math.min(currentPage * PER_PAGE, filtered.length);

  el.innerHTML = `
    <span>${s}–${e} de ${filtered.length}</span>
    <div class="pagination__btns">
      <button class="pagination__btn" id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      ${Array.from({ length: total }, (_, i) =>
        `<button class="pagination__btn ${i + 1 === currentPage ? 'is-active' : ''}" data-page="${i + 1}">${i + 1}</button>`
      ).join('')}
      <button class="pagination__btn" id="nextPage" ${currentPage === total ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>`;

  document.getElementById('prevPage')?.addEventListener('click', () => { currentPage--; renderTable(); renderPagination(); });
  document.getElementById('nextPage')?.addEventListener('click', () => { currentPage++; renderTable(); renderPagination(); });
  el.querySelectorAll('[data-page]').forEach(b =>
    b.addEventListener('click', () => { currentPage = parseInt(b.dataset.page); renderTable(); renderPagination(); })
  );
}

/* ─── FILTROS ─────────────────────────────────────────────── */
function sortData() {
  filtered.sort((a, b) => {
    let va = a[sortCol] ?? '';
    let vb = b[sortCol] ?? '';
    if (sortCol === 'valor_venta') {
      va = parseFloat(va) || 0;
      vb = parseFloat(vb) || 0;
    } else if (sortCol.startsWith('fecha')) {
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
  const q      = document.getElementById('searchPedidos')?.value.toLowerCase().trim() || '';
  const estado = document.getElementById('filterEstado')?.value || '';
  const pago   = document.getElementById('filterPago')?.value   || '';

  filtered = allPedidos.filter(p => {
    const matchQ      = !q      || p.id?.toLowerCase().includes(q) || p.cliente?.toLowerCase().includes(q) || p.cliente_cel?.includes(q);
    const matchEstado = !estado || p.estado    === estado;
    const matchPago   = !pago   || p.medio_pago === pago;
    return matchQ && matchEstado && matchPago;
  });

  sortData();
  currentPage = 1;
  renderTable();
  renderPagination();
  updateSortIcons();
  document.getElementById('pedidosCount').textContent =
    `${filtered.length} pedido${filtered.length !== 1 ? 's' : ''}`;
}

/* ─── MODAL EDITAR ───────────────────────────────────────────── */
let editingId = null;
let editingEstado = null;

async function abrirModalEditar(id) {
  editingId = id;
  const pedido = allPedidos.find(p => p.id === id);
  if (!pedido) return;
  editingEstado = pedido.estado || null;

  try { vendedores = await api.get('/auth/vendedores?rol=vendedor'); } catch {}

  document.getElementById('modalEditarPedidoTitle').textContent = `Editar ${id}`;
  document.getElementById('modalEditarPedidoBody').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label form-label--required">Fecha de entrega</label>
        <input class="form-input" type="date" id="epFechaEntrega"
          value="${pedido.fecha_entrega ? pedido.fecha_entrega.split('T')[0] : ''}"/>
      </div>
      <div class="form-group">
        <label class="form-label form-label--required">Vendedor</label>
        <select class="form-input" id="epVendedor">
          <option value="" disabled selected>Selecciona vendedor…</option>
          ${vendedores.map(v => `<option value="${v.id}" ${v.id === pedido.vendedor_id ? 'selected' : ''}>${v.nombre}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label form-label--required">Medio de pago</label>
      <select class="form-input" id="epMedioPago">
        ${['Por confirmar','Nequi','Daviplata','Transferencia','Efectivo','MP'].map(m =>
          `<option value="${m}" ${pedido.medio_pago === m ? 'selected' : ''}>${m}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Estado</label>
      <select class="form-input" id="epEstado">
        ${Object.entries(ESTADO_CONFIG).map(([val, cfg]) =>
          `<option value="${val}" ${pedido.estado === val ? 'selected' : ''}>${cfg.label}</option>`
        ).join('')}
      </select>
    </div>
  `;
  window.AdminModal.open('modalEditarPedido');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnGuardarEditarPedido')?.addEventListener('click', async () => {
    const epVendedorId = document.getElementById('epVendedor')?.value;
    if (!epVendedorId) { window.AdminToast?.error('Campo requerido', 'Selecciona un vendedor'); return; }
    try {
      const nuevoEstado = document.getElementById('epEstado')?.value;
      await api.put(`/pedidos/${editingId}`, {
        vendedor_id: epVendedorId,
        fecha_entrega: document.getElementById('epFechaEntrega')?.value || null,
        medio_pago:   document.getElementById('epMedioPago')?.value || null,
      });
      if (nuevoEstado && nuevoEstado !== editingEstado) {
        await api.patch(`/pedidos/${editingId}/estado`, { estado: nuevoEstado });
      }
      window.AdminToast?.success('Pedido actualizado');
      window.AdminModal.close('modalEditarPedido');
      await loadData();
    } catch (err) {
      window.AdminToast?.error('Error', err.message);
    }
  });
});

/* ─── ELIMINAR ────────────────────────────────────────────── */
function confirmDelete(id, num) {
  window.AdminConfirm.show(
    `¿Eliminar el pedido <strong>${num}</strong>? Esta acción no se puede deshacer.`,
    async () => {
      try {
        await api.delete(`/pedidos/${id}`);
        window.AdminToast?.success('Pedido eliminado');
        await loadData();
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    }
  );
}

/* ─── CARGAR DATOS ────────────────────────────────────────── */
async function loadData() {
  try {
    allPedidos = await api.get('/pedidos');
    applyFilters();
  } catch (err) {
    window.AdminToast?.error('Error', 'No se pudieron cargar los pedidos');
  }
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  window.AdminAuth.populateUserInfo(session);

  window.AdminFilterTags.init({
    filters: [
      { id: 'searchPedidos', label: 'Búsqueda', type: 'search' },
      { id: 'filterEstado',  label: 'Estado',   type: 'select' },
      { id: 'filterPago',    label: 'Pago',     type: 'select' },
    ],
    containerId: 'activeFilters',
    onClear: applyFilters,
  });

  /* Aplicar filtro desde URL si viene de la campana */
  const urlParams = new URLSearchParams(window.location.search);
  const estadoParam = urlParams.get('estado');
  if (estadoParam) {
    const filterEl = document.getElementById('filterEstado');
    if (filterEl) filterEl.value = estadoParam;
  }

  loadData();

  let searchTimer;
  document.getElementById('searchPedidos')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 300);
  });
  document.getElementById('filterEstado')?.addEventListener('change', applyFilters);
  document.getElementById('filterPago')?.addEventListener('change',   applyFilters);

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
