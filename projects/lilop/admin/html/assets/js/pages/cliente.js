/* ============================================================
   Lilop Admin — pages/cliente.js
   Vista detalle: header cliente + pedidos + productos.
   Usa únicamente clases de admin.css y variables de tokens.css.
   ============================================================ */

'use strict';

const session = window.AdminAuth.guard();
if (!session) throw new Error('No auth');

const api = window.AdminApi;

/* ── ID del cliente desde la URL ── */
const params    = new URLSearchParams(window.location.search);
const clienteId = params.get('id');
if (!clienteId) window.location.href = '/clientes.html';

/* ── Estado global ── */
let clienteData  = null;
let pedidosData  = [];
let pedidoActivo = null;

/* ── Catálogos dinámicos ── */
const catalogoProductos = new Set();
const catalogoTamanios  = new Set();

/* ── Diseños desde API ── */
let DISENOS = [];
let catalogoTipos = [];
let disenoSeleccionado = null;

/* ── Utilidades ── */
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

/* ── Badges de estado usando status-badge de admin.css ── */
const ESTADO_PEDIDO_MAP = {
  por_confirmar:   { label: 'Por confirmar',   cls: 'status-badge--pending'    },
  en_alistamiento: { label: 'En alistamiento', cls: 'status-badge--processing' },
  por_entregar:    { label: 'Por entregar',     cls: 'status-badge--shipped'    },
  entregado:       { label: 'Entregado',        cls: 'status-badge--delivered'  },
  cancelado:       { label: 'Cancelado',        cls: 'status-badge--cancelled'  },
};
const ESTADO_PRODUCTO_MAP = {
  'Por Comprar': { label: 'Por Comprar', cls: 'status-badge--pending'    },
  'Comprado':    { label: 'Comprado',    cls: 'status-badge--processing' },
  'Terminado':       { label: 'Terminado',       cls: 'status-badge--shipped'    },
  'Entregado':   { label: 'Entregado',   cls: 'status-badge--delivered'  },
};

/* ── Actualizar datalists ── */
function syncDatalist(id, set) {
  const dl = document.getElementById(id);
  if (dl) dl.innerHTML = [...set].sort().map(v => `<option value="${v}"></option>`).join('');
}

/* ─────────────────────────────────────────────────────────────
   RENDER HEADER CLIENTE
───────────────────────────────────────────────────────────── */
function renderClienteHeader(c) {
  const inicial = c.nombre.charAt(0).toUpperCase();
  return `
    <div class="admin-panel mb-6">
      <div class="cliente-header p-6 d-flex items-center gap-6 flex-wrap">

        <!-- Avatar -->
        <div class="d-flex items-center justify-center font-display text-2xl font-bold text-white shrink-0" style="width:64px;height:64px;border-radius:50%;background:var(--grad-primary)">
          ${inicial}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="d-flex items-center gap-3 flex-wrap mb-1">
            <h1 class="font-display text-xl font-semibold text-ink">${c.nombre}</h1>
            ${c.origen_venta ? `<span class="items-center radius-pill text-xs font-medium text-violet shrink-0 nowrap" style="display:inline-flex;padding:2px var(--s-3);background:var(--color-soft)">${c.origen_venta}</span>` : ''}
          </div>
          <p class="text-xs text-light mb-3" style="font-family:var(--font-mono)">${c.id}</p>
          <div class="d-flex flex-wrap gap-5">
            ${campoHeader('Celular',     c.celular)}
            ${campoHeader('Ciudad',      c.ciudad ? `${c.ciudad}${c.departamento ? ', '+c.departamento : ''}` : null)}
            ${campoHeader('Localidad',   c.localidad)}
            ${campoHeader('Barrio',      c.barrio)}
            ${campoHeader('Dirección',   c.direccion)}
          </div>
        </div>

        <!-- Acciones -->
        <div class="shrink-0">
          <button class="btn btn--outline btn--sm" id="btnEditarCliente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </button>
        </div>

      </div>
    </div>
  `;
}

function campoHeader(label, valor) {
  if (!valor) return '';
  return `
    <div class="d-flex flex-col" style="gap:2px">
      <span class="text-xs font-semibold uppercase text-light" style="letter-spacing:0.07em">${label}</span>
      <span class="text-sm text-ink font-medium">${valor}</span>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   HELPER FILTROS DE DISEÑOS
───────────────────────────────────────────────────────────── */
function htmlFiltrosDisenos(prefijo) {
  return `
    <div class="d-flex flex-col gap-2 mb-3">
      <div class="pos-relative">
        <svg class="pos-absolute text-light" style="left:9px;top:50%;transform:translateY(-50%);width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="search" class="form-input" id="${prefijo}Search" placeholder="Buscar diseño…" style="padding-left:30px;"/>
      </div>
      <div class="d-flex gap-2">
        <select class="form-input flex-1" id="${prefijo}Col">
          <option value="">Catálogo</option>
          <option value="adulto_diseno">Adulto — Diseño</option>
          <option value="adulto_unicolor">Adulto — Unicolor</option>
          <option value="nino">Niño</option>
          <option value="nina">Niña</option>
        </select>
        <select class="form-input flex-1" id="${prefijo}Est">
          <option value="">Estado</option>
          <option value="Disponible">Disponible</option>
          <option value="Agotado">Agotado</option>
        </select>
      </div>
    </div>`;
}

function renderDisenosGrid(gridId, claseOpt, disenoActivo, prefijo) {
  const q   = document.getElementById(`${prefijo}Search`)?.value.toLowerCase().trim() || '';
  const col = document.getElementById(`${prefijo}Col`)?.value || '';
  const est = document.getElementById(`${prefijo}Est`)?.value || '';

  const tipoProd = prefijo === 'add'
    ? document.getElementById('pNombre')?.value || ''
    : prefijo === 'edit'
      ? (window._editProductoNombre || '')
      : '';
  const tipoObj = tipoProd
    ? catalogoTipos.find(t => t.nombre === tipoProd)
    : null;

  const filtrados = DISENOS.filter(d =>
    (!q       || d.nombre.toLowerCase().includes(q)) &&
    (!col     || d.catalogo === col) &&
    (!est     || d.estado === est) &&
    (!tipoObj || (d.catalogo_ids || []).includes(tipoObj.id))
  );

  const grid = document.getElementById(gridId);
  if (!grid) return;

  if (!filtrados.length) {
    grid.innerHTML = `<p class="text-center text-xs text-muted p-4" style="grid-column:1/-1">Sin diseños</p>`;
    return;
  }

  grid.innerHTML = filtrados.map(d => {
    const sel = d.nombre === disenoActivo;
    return `
      <div class="${claseOpt}" data-nombre="${d.nombre}"
        style="border:2px solid ${sel ? 'var(--color-violet)' : 'var(--color-border)'};
               box-shadow:${sel ? '0 0 0 3px rgba(108,63,196,0.15)' : 'none'};
               border-radius:var(--r-md);overflow:hidden;cursor:pointer;aspect-ratio:1;
               background:${sel ? 'var(--color-soft)' : 'var(--color-fog)'};
               display:flex;flex-direction:column;align-items:center;justify-content:center;
               gap:var(--s-1);transition:all var(--duration-fast);position:relative;">
        ${d.imagen
          ? `<img class="pos-absolute" src="https://api.lilop.store${d.imagen}" alt="${d.nombre}" style="width:100%;height:100%;object-fit:cover;inset:0" loading="lazy" />`
          : `<svg class="text-lavender" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24">
               <rect x="3" y="3" width="18" height="18" rx="2"/>
               <circle cx="8.5" cy="8.5" r="1.5"/>
               <polyline points="21 15 16 10 5 21"/>
             </svg>`}
        <span style="font-size:9px;color:var(--color-text-muted);text-align:center;
               position:relative;z-index:1;background:rgba(255,255,255,0.85);
               padding:2px 4px;border-radius:2px;line-height:var(--leading-snug);">${d.nombre}</span>
      </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────────────────────
   RENDER TARJETA DE PRODUCTO
───────────────────────────────────────────────────────────── */
function renderProductoCard(prod) {
  const est = ESTADO_PRODUCTO_MAP[prod.estado] || { label: prod.estado, cls: '' };
  return `
    <div class="pedido-producto-card shrink-0 radius-lg d-flex flex-col pos-relative" style="background:var(--color-white);border:1px solid var(--color-border);overflow:hidden;transition:box-shadow var(--duration-base) var(--ease),border-color var(--duration-base)" onmouseover="this.style.boxShadow='var(--shadow-sm)';this.style.borderColor='var(--color-lilac)';this.querySelector('.prod-actions').style.opacity='1'" onmouseout="this.style.boxShadow='';this.style.borderColor='var(--color-border)';this.querySelector('.prod-actions').style.opacity='0'">

      <!-- Botones acción -->
      <div class="prod-actions pos-absolute d-flex" style="top:var(--s-2);right:var(--s-2);gap:4px;opacity:0;transition:opacity var(--duration-fast);z-index:1">
        <button class="size-26 radius-sm text-violet cursor-pointer d-flex items-center justify-center" data-action="editar-producto" data-producto-id="${prod.id}" data-producto-nombre="${prod.nombre}" data-producto-tamanio="${prod.tamanio || ''}" data-producto-diseno="${prod.diseno || ''}" data-producto-override="${prod.valor_venta_override ?? ''}" style="border:none;background:rgba(255,255,255,0.92);transition:background var(--duration-fast)" onmouseover="this.style.background='var(--color-soft)'" onmouseout="this.style.background='rgba(255,255,255,0.92)'" aria-label="Editar producto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="size-26 radius-sm cursor-pointer d-flex items-center justify-center" data-action="abrir-costos" data-producto-id="${prod.id}" data-producto-nombre="${prod.nombre}" style="border:none;background:rgba(255,255,255,0.92);color:#b8860b;transition:background var(--duration-fast)" onmouseover="this.style.background='#fef3c7'" onmouseout="this.style.background='rgba(255,255,255,0.92)'" aria-label="Agregar costo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
        </button>
        <button class="size-26 radius-sm text-error cursor-pointer d-flex items-center justify-center" data-action="eliminar-producto" data-producto-id="${prod.id}" data-producto-nombre="${prod.nombre}" style="border:none;background:rgba(255,255,255,0.92);transition:background var(--duration-fast)" onmouseover="this.style.background='var(--color-error-bg)'" onmouseout="this.style.background='rgba(255,255,255,0.92)'" aria-label="Eliminar producto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Imagen / placeholder -->
      <div class="pos-relative d-flex flex-col items-center justify-center gap-2 p-3" style="width:100%;aspect-ratio:3/4;background:var(--grad-card);overflow:hidden">
        ${(() => {
          const d = DISENOS.find(x => x.nombre === prod.diseno);
          return d?.imagen
            ? `<img class="pos-absolute" src="https://api.lilop.store${d.imagen}" alt="${prod.diseno}" data-lightbox="https://api.lilop.store${d.imagen}" style="inset:0;width:100%;height:100%;object-fit:cover;cursor:zoom-in" loading="lazy" />`
            : `<svg class="text-lavender" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
                 <rect x="3" y="3" width="18" height="18" rx="2"/>
                 <circle cx="8.5" cy="8.5" r="1.5"/>
                 <polyline points="21 15 16 10 5 21"/>
               </svg>
               <span class="text-xs text-light text-center" style="line-height:var(--leading-snug)">${prod.diseno || 'Sin diseño'}</span>`;
        })()}
      </div>

      <!-- Datos -->
      <div class="p-3-4 flex-1 d-flex flex-col gap-1">
        <p class="text-sm font-semibold text-ink" style="line-height:var(--leading-snug)">${prod.nombre}${prod.tamanio ? ` — ${prod.tamanio}` : ''}</p>
        <div class="mt-2">
          <span class="status-badge ${est.cls} cursor-pointer select-none" data-action="cambiar-estado-producto" data-producto-id="${prod.id}" data-estado="${prod.estado}" style="font-size:10px;padding:2px 8px" title="Clic para cambiar estado">${est.label}</span>
        </div>

        <!-- Sección expandible financiera -->
        <div class="mt-2" style="border-top:1px solid var(--color-border);padding-top:var(--s-2)">
          <button class="d-flex items-center justify-between cursor-pointer" style="width:100%;background:none;border:none;padding:0">
            <span class="font-semibold uppercase text-light" style="font-size:10px;letter-spacing:0.07em">Detalle costos</span>
            <svg class="exp-icon text-light shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="transition:transform var(--duration-fast)">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div class="d-none flex-col mt-2" style="gap:4px">
            <div class="d-flex justify-between">
              <span class="text-light" style="font-size:10px">Venta</span>
              <span class="font-semibold text-violet" style="font-size:10px">${prod.valor_venta_override ? formatPrice(prod.valor_venta_override) : '—'}</span>
            </div>
            ${(prod.compras || []).map(c => `
            <div class="d-flex justify-between">
              <span class="text-light" style="font-size:10px">${c.concepto}</span>
              <span class="text-muted" style="font-size:10px">${formatPrice(c.valor)}</span>
            </div>`).join('')}
            ${!(prod.compras || []).length ? `<p class="text-light text-center" style="font-size:10px">Sin costos</p>` : ''}
          </div>
        </div>

      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   RENDER TARJETA AGREGAR PRODUCTO
───────────────────────────────────────────────────────────── */
function renderAddCard(pedidoId) {
  return `
    <div class="pedido-producto-card shrink-0 radius-lg cursor-pointer d-flex flex-col items-center justify-center gap-3" data-action="abrir-modal-producto" data-pedido-id="${pedidoId}" style="min-height:240px;border:2px dashed var(--color-lilac);background:transparent;transition:all var(--duration-base) var(--ease)" onmouseover="this.style.borderColor='var(--color-violet)';this.style.background='var(--color-soft)'" onmouseout="this.style.borderColor='var(--color-lilac)';this.style.background='transparent'" role="button" tabindex="0" aria-label="Agregar producto">
      <div class="d-flex items-center justify-center" style="width:44px;height:44px;border-radius:50%;background:var(--color-soft)">
        <svg class="text-violet" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <span class="text-xs font-semibold text-violet text-center">Agregar<br>producto</span>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   RENDER TARJETA DE PEDIDO
───────────────────────────────────────────────────────────── */
function renderPedidoCard(pedido) {
  const est       = ESTADO_PEDIDO_MAP[pedido.estado] || { label: pedido.estado, cls: '' };
  const productos = pedido.productos || [];
  const ganancia  = pedido.ganancias != null
    ? pedido.ganancias
    : (pedido.valor_venta - (pedido.costo || 0) - (pedido.valor_domicilio || 0) - (pedido.comision || 0) - (pedido.costos_otros || 0));

  return `
    <div class="admin-panel mb-5">
      <div class="pedido-layout d-flex" style="min-height:0">

        <!-- Panel izquierdo (~30%) -->
        <div class="pedido-panel-left shrink-0 p-5 d-flex flex-col gap-4">



          <!-- Select estado + botones pedido -->
          <div class="d-flex items-center gap-2">
            <select class="form-input text-xs flex-1" data-pedido-id="${pedido.id}" data-action="cambiar-estado" style="padding:5px 28px 5px 8px;height:auto">
              ${Object.entries(ESTADO_PEDIDO_MAP).map(([val, info]) =>
                `<option value="${val}" ${pedido.estado === val ? 'selected' : ''}>${info.label}</option>`
              ).join('')}
            </select>
            <div class="d-flex shrink-0" style="gap:4px">
              <button class="btn btn--sm btn--outline btn--icon" data-action="editar-pedido" data-pedido-id="${pedido.id}" aria-label="Editar pedido">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn--sm btn--outline btn--icon" data-action="costos-pedido" data-pedido-id="${pedido.id}" aria-label="Costos del pedido" style="color:#b8860b;border-color:#b8860b;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              </button>
              <button class="btn btn--sm btn--danger btn--icon" data-action="eliminar-pedido" data-pedido-id="${pedido.id}" aria-label="Eliminar pedido">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
              <button class="btn btn--sm btn--icon" data-action="enviar-domicilio" data-pedido-id="${pedido.id}" aria-label="Enviar a domicilio"
                style="color:#25D366;border:1px solid #25D366;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Fechas y vendedor -->
          <div class="p-3 radius-md d-flex flex-col gap-2" style="background:var(--color-fog)">
            ${campoFinanciero('Venta',    formatDate(pedido.fecha_venta))}
            ${pedido.fecha_entrega ? campoFinanciero('Entrega',  formatDate(pedido.fecha_entrega)) : ''}
            ${pedido.vendedor      ? campoFinanciero('Vendedor', pedido.vendedor) : ''}
            ${pedido.medio_pago    ? campoFinanciero('Pago',     pedido.medio_pago) : ''}
          </div>

          <!-- Financiero -->
          <div class="p-3 radius-md d-flex flex-col gap-2" style="background:var(--color-fog)">
            ${campoFinanciero('Total',     formatPrice(pedido.valor_venta), 'var(--color-text)', true)}
            ${campoFinanciero('Costo',     formatPrice(pedido.costo || 0))}
            ${campoFinanciero('Domicilio', formatPrice(pedido.valor_domicilio || 0))}
            ${campoFinanciero('Comisión',  formatPrice(pedido.comision || 0))}
            ${campoFinanciero('Otros',     formatPrice(pedido.costos_otros || 0))}
            <div class="mt-1" style="border-top:1px solid var(--color-border);padding-top:var(--s-2)">
              ${campoFinanciero('Ganancia', formatPrice(ganancia), ganancia >= 0 ? 'var(--color-success)' : 'var(--color-error)', true)}
            </div>
          </div>

          ${pedido.notas ? `
          <p class="text-xs font-semibold text-muted mb-1">Observaciones</p>
          <p class="text-xs text-muted p-2-3 radius-sm" style="background:var(--color-fog);border-left:2px solid var(--color-lilac);line-height:var(--leading-snug)">${pedido.notas}</p>` : ''}
        </div>

        <!-- Panel derecho: productos con scroll horizontal -->
        <div class="pedido-panel-right flex-1 min-w-0 p-5" style="overflow-x:auto">
          <div class="pedido-productos-grid d-flex gap-4" id="grid-${pedido.id}">
            ${productos.map(p => renderProductoCard(p)).join('')}
            ${renderAddCard(pedido.id)}
          </div>
        </div>

      </div>
    </div>
  `;
}

function campoPanel(label, valor) {
  return `
    <div class="d-flex items-center justify-between gap-2">
      <span class="font-semibold uppercase text-light nowrap" style="font-size:10px;letter-spacing:0.07em">${label}</span>
      <span class="text-xs text-ink font-medium" style="text-align:right">${valor}</span>
    </div>`;
}

function campoFinanciero(label, valor, color = 'var(--color-text-muted)', bold = false) {
  return `
    <div class="d-flex justify-between items-center">
      <span class="text-xs text-light">${label}</span>
      <span class="text-xs" style="font-weight:${bold ? 'var(--weight-semibold)' : 'var(--weight-regular)'};color:${color}">${valor}</span>
    </div>`;
}


/* ─────────────────────────────────────────────────────────────
   RENDER PÁGINA COMPLETA
───────────────────────────────────────────────────────────── */
function renderDetalle() {
  document.getElementById('clienteDetalle').innerHTML = `
    ${renderClienteHeader(clienteData)}

    <div class="d-flex items-center justify-between mb-4 flex-wrap gap-3">
      <div class="d-flex gap-3" style="align-items:baseline">
        <h2 class="font-display text-lg font-semibold">Pedidos</h2>
        <span class="text-sm text-muted">${pedidosData.length} pedido${pedidosData.length !== 1 ? 's' : ''}</span>
      </div>
      <button class="btn btn--primary btn--sm" id="btnNuevoPedido">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo pedido
      </button>
    </div>

    ${pedidosData.length
      ? pedidosData.map(p => renderPedidoCard(p)).join('')
      : `<div class="admin-panel">
           <div class="empty-state">
             <div class="empty-state__icon">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                 <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
               </svg>
             </div>
             <p class="empty-state__title">Sin pedidos</p>
             <p class="empty-state__desc">Este cliente no tiene pedidos registrados</p>
           </div>
         </div>`
    }
  `;

  bindEventos();
}

/* ─────────────────────────────────────────────────────────────
   BIND DE EVENTOS
───────────────────────────────────────────────────────────── */
function bindEventos() {
  document.getElementById('btnEditarCliente')?.addEventListener('click', abrirModalEditar);
  document.getElementById('btnNuevoPedido')?.addEventListener('click', abrirModalNuevoPedido);

  document.querySelectorAll('[data-action="abrir-modal-producto"]').forEach(el => {
    el.addEventListener('click',   () => abrirModalProducto(el.dataset.pedidoId));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') abrirModalProducto(el.dataset.pedidoId); });
  });

  document.querySelectorAll('[data-action="editar-producto"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pedido = pedidosData.find(p => (p.productos || []).some(pr => pr.id === btn.dataset.productoId));
      if (pedido) pedidoActivo = pedido.id;
      abrirModalEditarProducto(
        btn.dataset.productoId,
        btn.dataset.productoNombre,
        btn.dataset.productoTamanio,
        btn.dataset.productoDiseno,
        btn.dataset.productoOverride || null
      );
    });
  });

  document.querySelectorAll('[data-action="abrir-costos"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pedido = pedidosData.find(p => (p.productos || []).some(pr => pr.id === btn.dataset.productoId));
      if (pedido) pedidoActivo = pedido.id;
      abrirModalCostos(btn.dataset.productoId, btn.dataset.productoNombre);
    });
  });

  document.querySelectorAll('[data-action="eliminar-producto"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      eliminarProducto(btn.dataset.productoId, btn.dataset.productoNombre);
    });
  });

  document.querySelectorAll('[data-action="editar-pedido"]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditarPedido(btn.dataset.pedidoId));
  });
  document.querySelectorAll('[data-action="costos-pedido"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      abrirModalCostosPedido(btn.dataset.pedidoId);
    });
  });

  document.querySelectorAll('[data-action="enviar-domicilio"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      abrirModalDomicilio(btn.dataset.pedidoId);
    });
  });

  document.querySelectorAll('[data-action="eliminar-pedido"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.AdminConfirm.show(
        `¿Eliminar el pedido <strong>${btn.dataset.pedidoId}</strong>? Se eliminarán también todos sus productos.`,
        async () => {
          try {
            await api.delete(`/pedidos/${btn.dataset.pedidoId}`);
            window.AdminToast?.success('Pedido eliminado');
            await cargarDatos();
          } catch (err) {
            window.AdminToast?.error('Error', err.message);
          }
        }
      );
    });
  });

  document.querySelectorAll('[data-action="cambiar-estado"]').forEach(sel => {
    sel.addEventListener('change', async () => {
      try {
        await api.patch(`/pedidos/${sel.dataset.pedidoId}/estado`, { estado: sel.value });
        window.AdminToast?.success('Estado actualizado');
        await cargarDatos();
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    });
  });

  const ESTADOS_PRODUCTO = ['Por Comprar', 'Comprado', 'Terminado'];
  document.querySelectorAll('[data-action="cambiar-estado-producto"]').forEach(badge => {
    badge.addEventListener('click', async e => {
      e.stopPropagation();
      const productoId  = badge.dataset.productoId;
      const estadoActual = badge.dataset.estado;
      const idx          = ESTADOS_PRODUCTO.indexOf(estadoActual);
      const nuevoEstado  = ESTADOS_PRODUCTO[(idx + 1) % ESTADOS_PRODUCTO.length];
      const pedido       = pedidosData.find(p => (p.productos || []).some(pr => pr.id === productoId));
      if (!pedido) return;
      try {
        await api.put(`/pedidos/${pedido.id}/productos/${productoId}`, { estado: nuevoEstado });
        window.AdminToast?.success(`Estado: ${nuevoEstado}`);
        await cargarDatos();
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   MODAL EDITAR CLIENTE
───────────────────────────────────────────────────────────── */
function abrirModalEditar() {
  document.getElementById('modalEditarClienteBody').innerHTML = window.renderFormCliente(clienteData);
  window.initFormCliente(clienteData);
  api.get('/clientes/listas/origenes').then(origenes => {
    window.poblarOrigenes(origenes, clienteData?.origen_venta || null);
  }).catch(() => {});
  window.AdminModal.open('modalEditarCliente');
}

document.getElementById('btnGuardarCliente')?.addEventListener('click', async () => {
  if (!window.validarFormCliente()) return;
  try {
    await api.put(`/clientes/${clienteId}`, window.recolectarFormCliente());
    window.AdminToast?.success('Cliente actualizado');
    window.AdminModal.close('modalEditarCliente');
    await cargarDatos();
  } catch (err) {
    window.AdminToast?.error('Error', err.message);
  }
});

/* ─────────────────────────────────────────────────────────────
   MODAL AGREGAR PRODUCTO
───────────────────────────────────────────────────────────── */
function abrirModalProducto(pedidoId) {
  pedidoActivo       = pedidoId;
  disenoSeleccionado = null;

  document.getElementById('modalProductoBody').innerHTML = `
    <div class="d-flex flex-col gap-4">
      <p class="text-xs font-semibold uppercase text-light" style="letter-spacing:0.08em;padding-bottom:var(--s-2);border-bottom:1px solid var(--color-border)">Datos del producto</p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label form-label--required">Tipo de producto</label>
          <select class="form-input" id="pNombre">
            <option value="">Selecciona tipo…</option>
            ${catalogoTipos.filter(t => t.activo).map(t =>
              `<option value="${t.nombre}">${t.nombre}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--required">Tamaño</label>
          <select class="form-input" id="pTamanio">
            <option value="">Selecciona…</option>
            <option value="Unico">Único</option>
            <option value="Sencillo">Sencillo</option>
            <option value="Semidoble">Semidoble</option>
            <option value="Doble">Doble</option>
            <option value="Queen">Queen</option>
            <option value="King">King</option>
          </select>
        </div>
      </div>
    </div>

    <div class="d-flex flex-col gap-3">
      <p class="text-xs font-semibold uppercase text-light" style="letter-spacing:0.08em;padding-bottom:var(--s-2);border-bottom:1px solid var(--color-border)">Diseño <span class="font-regular" style="text-transform:none;letter-spacing:0">(selecciona uno)</span></p>
      ${htmlFiltrosDisenos('add')}
      <div class="d-grid gap-3 p-1" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr));max-height:240px;overflow-y:auto" id="addDisenosGrid"></div>
      <div class="d-none items-center gap-3 p-3-4 radius-md" id="disenoPreview" style="background:var(--color-soft);border:1px solid var(--color-lilac)">
        <svg class="text-violet shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <span class="text-sm font-medium text-violet" id="disenoPreviewNombre"></span>
      </div>
    </div>
  `;

  renderDisenosGrid('addDisenosGrid', 'diseno-opt', null, 'add');
  bindDisenoOpts();

  ['addSearch','addCol','addEst'].forEach(id => {
    document.getElementById(id)?.addEventListener(id === 'addSearch' ? 'input' : 'change', () => {
      renderDisenosGrid('addDisenosGrid', 'diseno-opt', disenoSeleccionado, 'add');
      bindDisenoOpts();
    });
  });

  function bindDisenoOpts() {
    document.querySelectorAll('.diseno-opt').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.diseno-opt').forEach(i => {
          i.classList.remove('sel');
          i.style.borderColor = 'var(--color-border)';
          i.style.boxShadow   = '';
          i.style.background  = 'var(--color-fog)';
        });
        item.classList.add('sel');
        item.style.borderColor = 'var(--color-violet)';
        item.style.boxShadow   = '0 0 0 3px rgba(108,63,196,0.15)';
        item.style.background  = 'var(--color-soft)';
        disenoSeleccionado = item.dataset.nombre;
        const prev = document.getElementById('disenoPreview');
        const nom  = document.getElementById('disenoPreviewNombre');
        if (prev) prev.style.display = 'flex';
        if (nom)  nom.textContent    = disenoSeleccionado;
      });
    });
  }

  /* Bind tipo producto → filtrar diseños */
  document.getElementById('pNombre')?.addEventListener('change', () => {
    disenoSeleccionado = null;
    renderDisenosGrid('addDisenosGrid', 'diseno-opt', null, 'add');
    bindDisenoOpts();
  });

  window.AdminModal.open('modalProducto');
}

document.getElementById('btnGuardarProducto')?.addEventListener('click', async () => {
  const nombre  = document.getElementById('pNombre')?.value.trim();
  const tamanio = document.getElementById('pTamanio')?.value.trim();
  if (!nombre) {

    window.AdminToast?.error('Campo requerido', 'El nombre del producto es obligatorio');
    return;
  }
  if (!tamanio) {
    window.AdminToast?.error('Campo requerido', 'El tamaño del producto es obligatorio');
    return;
  }
  if (!disenoSeleccionado) {
    window.AdminToast?.error('Campo requerido', 'Selecciona un diseño');
    return;
  }
  try {
    await api.post(`/pedidos/${pedidoActivo}/productos`, {
      nombre,
      tamanio: tamanio || null,
      diseno:  disenoSeleccionado || null,
      estado:  'Por Comprar',
    });
    if (nombre)  { catalogoProductos.add(nombre);  syncDatalist('dl-productos', catalogoProductos); }
    if (tamanio) { catalogoTamanios.add(tamanio);   syncDatalist('dl-tamanios',  catalogoTamanios);  }
    window.AdminModal.close('modalProducto');
    window.AdminToast?.success('Producto agregado');
    await cargarDatos();
  } catch (err) {
    window.AdminToast?.error('Error', err.message);
  }
});

/* ─────────────────────────────────────────────────────────────
   ELIMINAR PRODUCTO
───────────────────────────────────────────────────────────── */
function eliminarProducto(productoId, nombreProducto) {
  window.AdminConfirm.show(
    `¿Eliminar el producto <strong>${nombreProducto}</strong>? Se eliminarán también todas sus compras registradas.`,
    async () => {
      try {
        const pedido = pedidosData.find(p => (p.productos || []).some(pr => pr.id === productoId));
        if (!pedido) return;
        await api.delete(`/pedidos/${pedido.id}/productos/${productoId}`);
        window.AdminToast?.success('Producto eliminado');
        await cargarDatos();
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    }
  );
}

/* ─────────────────────────────────────────────────────────────
   CARGAR DATOS
───────────────────────────────────────────────────────────── */
async function cargarDatos() {
  try {
    [clienteData, pedidosData, DISENOS, catalogoTipos] = await Promise.all([
      api.get(`/clientes/${clienteId}`),
      api.get(`/clientes/${clienteId}/pedidos`),
      api.get('/disenos'),
      api.get('/catalogo'),
    ]);
    

    pedidosData = await Promise.all(
      pedidosData.map(async pedido => {
        try {
          const det = await api.get(`/pedidos/${pedido.id}`);
          (det.productos || []).forEach(p => {
            if (p.nombre)  catalogoProductos.add(p.nombre);
            if (p.tamanio) catalogoTamanios.add(p.tamanio);
          });
          return { ...pedido, productos: det.productos || [] };
        } catch { return { ...pedido, productos: [] }; }
      })
    );

    syncDatalist('dl-productos', catalogoProductos);
    syncDatalist('dl-tamanios',  catalogoTamanios);

    window.AdminLayout.init(clienteData.nombre);
    renderDetalle();

    /* Datalist de orígenes */
    try {
      const todos = await api.get('/clientes');
      const dl = document.getElementById('dl-origenes');
      if (dl) dl.innerHTML = [...new Set(todos.map(c => c.origen_venta).filter(Boolean))]
        .map(o => `<option value="${o}"></option>`).join('');
    } catch {}

  } catch (err) {
    if (err.message?.includes('404')) window.location.href = '/clientes.html';
    else window.AdminToast?.error('Error', 'No se pudo cargar el cliente');
  }
}

/* ─────────────────────────────────────────────────────────────
   MODAL NUEVO PEDIDO
───────────────────────────────────────────────────────────── */
async function abrirModalNuevoPedido() {
  try {
    vendedoresCache = await api.get('/auth/vendedores?rol=vendedor');
  } catch {}

  document.getElementById('modalNuevoPedidoBody').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label form-label--required">Fecha de entrega</label>
        <input class="form-input" type="date" id="npFechaEntrega"/>
      </div>
      <div class="form-group">
        <label class="form-label form-label--required">Vendedor</label>
        <select class="form-input" id="npVendedor">
          <option value="" disabled selected>Selecciona vendedor…</option>
          ${vendedoresCache.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label form-label--required">Medio de pago</label>
        <select class="form-input" id="npMedioPago">
          <option value="Por confirmar">Por confirmar</option>
          <option value="Nequi">Nequi</option>
          <option value="Daviplata">Daviplata</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Efectivo">Efectivo</option>
          <option value="MP">MP</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notas</label>
      <textarea class="form-input" id="npNotas" rows="3" placeholder="Observaciones del pedido…"></textarea>
    </div>
  `;
  window.AdminModal.open('modalNuevoPedido');
}

document.getElementById('btnGuardarNuevoPedido')?.addEventListener('click', async () => {
  const vendedor_id = document.getElementById('npVendedor')?.value;
  if (!vendedor_id) { window.AdminToast?.error('Campo requerido', 'Selecciona un vendedor'); return; }
  const body = {
    cliente_id:   clienteId,
    vendedor_id,
    valor_venta:  0,
    fecha_entrega: document.getElementById('npFechaEntrega')?.value || null,
    medio_pago:   document.getElementById('npMedioPago')?.value || null,
    estado:       'por_confirmar',
    notas:        document.getElementById('npNotas')?.value.trim() || null,
  };
  try {
    await api.post('/pedidos', body);
    window.AdminToast?.success('Pedido creado');
    window.AdminModal.close('modalNuevoPedido');
    await cargarDatos();
  } catch (err) {
    window.AdminToast?.error('Error', err.message);
  }
});

/* ─────────────────────────────────────────────────────────────
   MODAL COSTOS PEDIDO
───────────────────────────────────────────────────────────── */
let editandoPedidoId = null;
let vendedoresCache = [];
async function abrirModalEditarPedido(id) {
  editandoPedidoId = id;
  const pedido = pedidosData.find(p => p.id === id);
  if (!pedido) return;
  try { vendedoresCache = await api.get('/auth/vendedores?rol=vendedor'); } catch {}
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
          ${vendedoresCache.map(v => `<option value="${v.id}" ${v.id === pedido.vendedor_id ? 'selected' : ''}>${v.nombre}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Medio de pago</label>
      <select class="form-input" id="epMedioPago">
        ${['Por confirmar','Nequi','Daviplata','Transferencia','Efectivo','MP'].map(m =>
          `<option value="${m}" ${pedido.medio_pago === m ? 'selected' : ''}>${m}</option>`
        ).join('')}
      </select>
    </div>
  `;
  window.AdminModal.open('modalEditarPedido');
}
document.getElementById('btnGuardarEditarPedido')?.addEventListener('click', async () => {
  const epVendedorId = document.getElementById('epVendedor')?.value;
  if (!epVendedorId) { window.AdminToast?.error('Campo requerido', 'Selecciona un vendedor'); return; }
  try {
    await api.put(`/pedidos/${editandoPedidoId}`, {
      fecha_entrega: document.getElementById('epFechaEntrega')?.value || null,
      vendedor_id: epVendedorId,
      medio_pago: document.getElementById('epMedioPago')?.value || null,
    });
    window.AdminToast?.success('Pedido actualizado');
    window.AdminModal.close('modalEditarPedido');
    await cargarDatos();
  } catch (err) {
    window.AdminToast?.error('Error', err.message);
  }
});

let pedidoCostosActivo = null;

async function abrirModalDomicilio(pedidoId) {
  const pedido = pedidosData.find(p => p.id === pedidoId);
  if (!pedido) return;

  document.getElementById('modalDomicilioTitle').textContent = `Enviar domicilio — ${pedidoId}`;

  let domiciliarios = [];
  try { domiciliarios = await api.get('/auth/vendedores?rol=domiciliario'); } catch {}

  document.getElementById('modalDomicilioBody').innerHTML = `
    <div class="form-group">
      <label class="form-label form-label--required">Domiciliario</label>
      <select class="form-input" id="domSeleccionado">
        <option value="">Selecciona domiciliario…</option>
        ${domiciliarios.map(d => `<option value="${d.id}" data-nombre="${d.nombre}" data-celular="${d.celular || ''}">${d.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="p-3 radius-md text-xs text-muted" style="background:var(--color-fog)">
      <p class="font-semibold mb-2 text-ink">Resumen del pedido</p>
      <p><strong>${clienteData?.nombre || '—'}</strong> · ${clienteData?.celular || '—'}</p>
      <p>${[clienteData?.ciudad, clienteData?.localidad, clienteData?.barrio, clienteData?.direccion].filter(Boolean).join(' · ')}</p>
      <p class="mt-2">${(pedido.productos || []).map(p => `${p.nombre} — ${p.tamanio || 'S/T'}`).join('<br/>')}</p>
    </div>
  `;

  document.getElementById('btnEnviarDomicilio').onclick = async () => {
    const sel = document.getElementById('domSeleccionado');
    if (!sel.value) { window.AdminToast?.error('Requerido', 'Selecciona un domiciliario'); return; }
    const domNombre = sel.options[sel.selectedIndex].dataset.nombre;
    try {
      await api.post('/pedidos/' + pedidoId + '/domicilio-webhook', {
        domiciliario_id:     sel.value,
        domiciliario_nombre: domNombre,
        cliente_nombre:      clienteData?.nombre,
        cliente_telefono:    clienteData?.celular,
        ciudad:              clienteData?.ciudad,
        localidad:           clienteData?.localidad,
        barrio:              clienteData?.barrio,
        direccion:           clienteData?.direccion,
        productos:           (pedido.productos || []).map(p => ({
          nombre:  p.nombre,
          tamanio: p.tamanio,
          diseno:  p.diseno,
          imagen:  p.imagen || (DISENOS.find(d => d.nombre === p.diseno)?.imagen || null),
        })),
        valor_cobrar: pedido.valor_venta,
      });
      window.AdminToast?.success('Enviado', 'Datos enviados al domiciliario');
      window.AdminModal.close('modalDomicilio');
    } catch (err) {
      window.AdminToast?.error('Error', err.message);
    }
  };

  window.AdminModal.open('modalDomicilio');
}

async function abrirModalCostosPedido(pedidoId) {
  pedidoCostosActivo = pedidoId;
  document.getElementById('modalCostosPedidoTitle').textContent = `Costos — ${pedidoId}`;
  await renderModalCostosPedido();
  window.AdminModal.open('modalCostosPedido');
}

async function renderModalCostosPedido() {
  const body = document.getElementById('modalCostosPedidoBody');
  body.innerHTML = '<p class="text-center text-muted">Cargando...</p>';

  let datos = { domicilio: [], comision: null, otros: [] };
  let listaDoms = [], listaComisiones = [], listaConceptos = [];
  try {
    [datos, listaDoms, listaComisiones, listaConceptos] = await Promise.all([
      api.get(`/pedidos/${pedidoCostosActivo}/costos`),
      api.get('/auth/vendedores?rol=domiciliario'),
      api.get('/auth/vendedores?rol=vendedor'),
      api.get(`/pedidos/${pedidoCostosActivo}/costos/listas/conceptos`),
    ]);
  } catch {}

  /* ── Helpers de render ── */
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

  /* ── Handler unificado eliminar ── */
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
    await cargarDatos();
  }

  /* ── Handler unificado agregar ── */
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
    await cargarDatos();
  }

  /* ── Bind unificado ── */
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


/* ─────────────────────────────────────────────────────────────
   MODAL EDITAR PRODUCTO
───────────────────────────────────────────────────────────── */
let productoEditandoId = null;

function abrirModalEditarProducto(productoId, nombre, tamanio, diseno, override) {
  productoEditandoId = productoId;
  window._editProductoNombre = nombre;
  const tieneOverride = override !== null && override !== '' && override !== undefined;
  document.getElementById('modalEditarProductoTitle').textContent = `Editar — ${nombre}`;
  document.getElementById('modalEditarProductoBody').innerHTML = `
    <div class="form-group">
      <label class="form-label form-label--required">Tamaño</label>
      <select class="form-input" id="epTamanio">
        <option value="">Selecciona…</option>
        ${['Unico','Sencillo','Semidoble','Doble','Queen','King'].map(t =>
          `<option value="${t}" ${tamanio === t ? 'selected' : ''}>${t}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Valor de venta (COP)</label>
      <div class="d-flex gap-2 items-center">
        <input class="form-input flex-1" type="number" id="epOverrideValor" min="0" value="${tieneOverride ? override : ''}" placeholder="${tieneOverride ? override : 'Precio del catálogo'}" />
        <button type="button" id="btnValorOriginal" class="btn btn--ghost btn--sm nowrap shrink-0">
          Valor original
        </button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label form-label--required">Diseño</label>
      ${htmlFiltrosDisenos('edit')}
      <div class="d-grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr));max-height:220px;overflow-y:auto" id="editDisenosGrid"></div>
    </div>
  `;

  document.getElementById('btnValorOriginal')?.addEventListener('click', async () => {
    try {
      await api.put(`/pedidos/${pedidoActivo}/productos/${productoEditandoId}`, {
        tamanio: document.getElementById('epTamanio')?.value,
        diseno:  disenoEdit || diseno,
        valor_venta_override: null,
      });
      window.AdminToast?.success('Valor restablecido al catálogo');
      window.AdminModal.close('modalEditarProducto');
      await cargarDatos();
    } catch (err) {
      window.AdminToast?.error('Error', err.message);
    }
  });

  let disenoEdit = diseno;



  function bindDisenoOptsEdit() {
    document.querySelectorAll('.diseno-opt-edit').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.diseno-opt-edit').forEach(i => {
          i.style.borderColor = 'var(--color-border)';
          i.style.boxShadow   = '';
          i.style.background  = 'var(--color-fog)';
        });
        item.style.borderColor = 'var(--color-violet)';
        item.style.boxShadow   = '0 0 0 3px rgba(108,63,196,0.15)';
        item.style.background  = 'var(--color-soft)';
        disenoEdit = item.dataset.nombre;
      });
    });
  }

  renderDisenosGrid('editDisenosGrid', 'diseno-opt-edit', disenoEdit, 'edit');
  bindDisenoOptsEdit();

  ['editSearch','editCol','editEst'].forEach(id => {
    document.getElementById(id)?.addEventListener(id === 'editSearch' ? 'input' : 'change', () => {
      renderDisenosGrid('editDisenosGrid', 'diseno-opt-edit', disenoEdit, 'edit');
      bindDisenoOptsEdit();
    });
  });

  document.getElementById('btnGuardarEditarProducto').onclick = async () => {
    const tamanioVal   = document.getElementById('epTamanio')?.value;
    const overrideValor = parseFloat(document.getElementById('epOverrideValor')?.value);
    if (!tamanioVal) { window.AdminToast?.error('Campo requerido', 'Selecciona un tamaño'); return; }
    if (!disenoEdit) { window.AdminToast?.error('Campo requerido', 'Selecciona un diseño'); return; }
    try {
      await api.put(`/pedidos/${pedidoActivo}/productos/${productoEditandoId}`, {
        tamanio: tamanioVal,
        diseno:  disenoEdit,
        valor_venta_override: overrideValor > 0 ? overrideValor : null,
      });
      window.AdminToast?.success('Producto actualizado');
      window.AdminModal.close('modalEditarProducto');
      await cargarDatos();
    } catch (err) {
      window.AdminToast?.error('Error', err.message);
    }
  };

  window.AdminModal.open('modalEditarProducto');
}

/* ─────────────────────────────────────────────────────────────
   MODAL COSTOS PRODUCTO
───────────────────────────────────────────────────────────── */
const CONCEPTOS = ['Tela', 'Acolchado', 'Confección', 'Insumos', 'Otro'];
let productoActivoCostos = null;
let costosActuales = [];

function renderFilaCosto(idx, costo = null) {
  return `
    <div class="d-flex gap-4 items-end" id="fila-costo-${idx}">
      <div class="form-group">
        <label class="form-label form-label--required">Concepto</label>
        <select class="form-input" id="costo-concepto-${idx}">
          <option value="">Selecciona…</option>
          ${CONCEPTOS.map(c => `<option value="${c}" ${costo?.concepto === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label form-label--required">Valor</label>
        <input class="form-input" type="number" id="costo-valor-${idx}" min="0"
          value="${costo?.valor_unitario || ''}" placeholder="0"/>
      </div>
      <div class="shrink-0" style="padding-bottom:2px">
        ${costo
          ? `<button data-action="eliminar-costo" data-costo-id="${costo.id}"
               class="btn btn--sm btn--danger btn--icon">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                 <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
               </svg>
             </button>`
          : `<button id="btn-guardar-costo-nueva" class="btn btn--sm btn--primary"
               style="background:linear-gradient(135deg,#b8860b,#d4a017);box-shadow:none;">
               Guardar
             </button>`
        }
      </div>
    </div>`;
}

async function abrirModalCostos(productoId, productoNombre) {
  productoActivoCostos = productoId;
  document.getElementById('modalCostosTitle').textContent = `Costos — ${productoNombre}`;
  try {
    costosActuales = await api.get(`/pedidos/${pedidoActivo}/productos/${productoId}/compras`);
  } catch {
    costosActuales = [];
  }
  renderModalCostos();
  window.AdminModal.open('modalCostos');
}

function renderModalCostos() {
  const body = document.getElementById('modalCostosBody');
  if (!body) return;
  const total = costosActuales.reduce((s, c) => s + parseFloat(c.valor_total || 0), 0);

  body.innerHTML = `
    <div class="d-flex flex-col gap-4">

      <!-- Registros existentes (solo lectura) -->
      ${costosActuales.map(c => `
        <div class="d-flex items-center justify-between p-2-3 radius-sm" style="background:var(--color-fog)">
          <span class="text-sm">${c.concepto || '—'}</span>
          <div class="d-flex items-center gap-3">
            <span class="text-sm font-semibold">${formatPrice(c.valor_total)}</span>
            <button data-action="eliminar-costo" data-costo-id="${c.id}" class="btn btn--sm btn--danger btn--icon size-28 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </div>`).join('')}

      <!-- Total -->
      ${costosActuales.length > 0 ? `
      <div class="d-flex justify-between p-3-4 radius-md" style="background:var(--color-fog)">
        <span class="text-sm font-semibold">Total costos</span>
        <span class="text-sm font-bold text-violet">${formatPrice(total)}</span>
      </div>` : ''}

      <!-- Fila nueva -->
      <div style="border-top:1px solid var(--color-border);padding-top:var(--s-3);">
        ${renderFilaCosto('nueva')}
      </div>

    </div>
  `;

  body.querySelectorAll('[data-action="eliminar-costo"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.delete(`/pedidos/${pedidoActivo}/productos/${productoActivoCostos}/compras/${btn.dataset.costoId}`);
        costosActuales = costosActuales.filter(c => c.id !== btn.dataset.costoId);
        renderModalCostos();
        await cargarDatos();
        window.AdminToast?.success('Costo eliminado');
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    });
  });

  document.getElementById('btn-guardar-costo-nueva')?.addEventListener('click', async () => {
    const concepto = document.getElementById('costo-concepto-nueva')?.value;
    const valor    = parseFloat(document.getElementById('costo-valor-nueva')?.value);
    if (!concepto) { window.AdminToast?.error('Campo requerido', 'Selecciona un concepto'); return; }
    if (!valor || valor <= 0) { window.AdminToast?.error('Campo requerido', 'Ingresa un valor válido'); return; }
    try {
      const nueva = await api.post(`/pedidos/${pedidoActivo}/productos/${productoActivoCostos}/compras`, {
        concepto, cantidad: 1, valor_unitario: valor,
      });
      costosActuales.push(nueva);
      renderModalCostos();
      await cargarDatos();
      window.AdminToast?.success('Costo agregado');
    } catch (err) {
      window.AdminToast?.error('Error', err.message);
    }
  });
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  window.AdminAuth.populateUserInfo(session);
  cargarDatos();

  window.AdminLightbox.init();
  document.addEventListener('click', e => {
    const img = e.target.closest('[data-lightbox]');
    if (img) window.AdminLightbox.open(img.dataset.lightbox);
  });
});
