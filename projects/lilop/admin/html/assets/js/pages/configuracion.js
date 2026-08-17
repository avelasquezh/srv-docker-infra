'use strict';

const session = window.AdminAuth.guard();
if (!session) throw new Error('No auth');
window.AdminLayout.init('Configuración');

const api = window.AdminApi;
const TAMANIOS = ['Unico', 'Sencillo', 'Semidoble', 'Doble', 'Queen', 'King'];

function formatPrice(n) {
  if (!n || n === '0.00') return '';
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0 }).format(n);
}

/* ─── RENDER CATÁLOGO ─────────────────────────────────────── */
function renderCatalogo(productos) {
  const tbody = document.getElementById('catalogoBody');
  if (!productos.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state p-8">
      <p class="empty-state__title">Sin productos</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = productos.map(p => {
    const preciosMap = {};
    (p.precios || []).forEach(pr => { preciosMap[pr.tamanio] = pr; });

    return `
      <tr>
        <td class="font-semibold text-sm">${p.nombre}</td>
        ${TAMANIOS.map(t => `
          <td>
            <input type="number" min="0" class="form-input text-xs" style="width:100px;padding:6px 8px" data-catalogo-id="${p.id}" data-tamanio="${t}" value="${preciosMap[t] ? preciosMap[t].precio : ''}" placeholder="—" />
          </td>`).join('')}
        <td>
          <button data-action="toggle" data-id="${p.id}" class="btn btn--sm ${p.activo ? 'btn--primary' : 'btn--ghost'} text-xs">
            ${p.activo ? 'Activo' : 'Inactivo'}
          </button>
        </td>
      </tr>`;
  }).join('');

  /* Bind guardar precio al salir del input */
  tbody.querySelectorAll('input[data-catalogo-id]').forEach(input => {
    input.addEventListener('blur', async () => {
      const valor = parseFloat(input.value);
      if (isNaN(valor) || valor < 0) return;
      try {
        await api.post(`/catalogo/${input.dataset.catalogoId}/precios`, {
          tamanio: input.dataset.tamanio,
          precio:  valor,
        });
        window.AdminToast?.success('Precio guardado');
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    });
  });

  /* Bind toggle activo */
  tbody.querySelectorAll('[data-action="toggle"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.patch(`/catalogo/${btn.dataset.id}/toggle`, {});
        await loadCatalogo();
      } catch (err) {
        window.AdminToast?.error('Error', err.message);
      }
    });
  });
}

/* ─── CARGAR CATÁLOGO ─────────────────────────────────────── */
async function loadCatalogo() {
  try {
    const data = await api.get('/catalogo');
    renderCatalogo(data);
  } catch (err) {
    window.AdminToast?.error('Error', 'No se pudo cargar el catálogo');
  }
}

/* ─── NUEVO PRODUCTO ──────────────────────────────────────── */

/* ─── USUARIOS ────────────────────────────────────────────── */
const ROL_LABELS = { admin: 'Admin', vendedor: 'Vendedor', domiciliario: 'Domiciliario' };
let editandoUsuarioId = null;

async function loadUsuarios() {
  try {
    const data = await api.get('/usuarios');
    const tbody = document.getElementById('usuariosBody');
    if (!data.length) {
      tbody.innerHTML = '<tr><td class="text-center p-6 text-muted" colspan="6">Sin usuarios</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(u => `
      <tr>
        <td class="font-semibold">${u.nombre}</td>
        <td class="text-xs text-muted">${u.email || '—'}</td>
        <td><span class="status-badge ${u.rol === 'vendedor' ? 'status-badge--processing' : u.rol === 'domiciliario' ? 'status-badge--shipped' : 'status-badge--delivered'}">${ROL_LABELS[u.rol] || u.rol}</span></td>
        <td>${u.comision_pct}%</td>
        <td><span class="status-badge ${u.activo ? 'status-badge--delivered' : 'status-badge--cancelled'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn--sm btn--outline btn--icon" data-action="editar-usuario" data-id="${u.id}" aria-label="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn--sm btn--danger btn--icon" data-action="eliminar-usuario" data-id="${u.id}" data-nombre="${u.nombre}" aria-label="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-action="editar-usuario"]').forEach(btn =>
      btn.addEventListener('click', () => abrirModalUsuario(btn.dataset.id))
    );
    tbody.querySelectorAll('[data-action="eliminar-usuario"]').forEach(btn =>
      btn.addEventListener('click', () => {
        window.AdminConfirm.show(
          `¿Desactivar a <strong>${btn.dataset.nombre}</strong>?`,
          async () => {
            try {
              await api.delete(`/usuarios/${btn.dataset.id}`);
              window.AdminToast?.success('Usuario desactivado');
              await loadUsuarios();
            } catch (err) { window.AdminToast?.error('Error', err.message); }
          }
        );
      })
    );
  } catch (err) { window.AdminToast?.error('Error', 'No se pudieron cargar los usuarios'); }
}

function abrirModalUsuario(id) {
  editandoUsuarioId = id || null;
  const usuarios = window._usuariosCache || [];
  const u = id ? usuarios.find(x => x.id === id) : null;
  document.getElementById('modalUsuarioTitle').textContent = u ? `Editar — ${u.nombre}` : 'Nuevo usuario';
  document.getElementById('modalUsuarioBody').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label form-label--required">Nombre</label>
        <input class="form-input" id="uNombre" value="${u?.nombre || ''}"/>
      </div>
      <div class="form-group">
        <label class="form-label form-label--required">Rol</label>
        <select class="form-input" id="uRol">
          <option value="" disabled selected>Selecciona rol...</option>
          ${['vendedor','domiciliario','admin'].map(r => `<option value="${r}" ${u?.rol === r ? 'selected' : ''}>${ROL_LABELS[r]}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label form-label--required">Celular</label>
        <input class="form-input" id="uCelular" type="tel" value="${u?.celular || ''}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="uEmail" type="email" value="${u?.email || ''}"/>
      </div>
    </div>
    ${!u ? `
    <div class="form-group">
      <label class="form-label form-label--required">Contraseña</label>
      <input class="form-input" type="password" id="uPassword"/>
    </div>` : ''}
    ${u ? `
    <div class="form-group">
      <label class="form-label">Estado</label>
      <select class="form-input" id="uActivo">
        <option value="true" ${u.activo ? 'selected' : ''}>Activo</option>
        <option value="false" ${!u.activo ? 'selected' : ''}>Inactivo</option>
      </select>
    </div>` : ''}
  `;
  window.AdminModal.open('modalUsuario');
}

/* ─── ORÍGENES ────────────────────────────────────────────── */
async function loadOrigenes() {
  try {
    const data = await api.get('/maestros/origenes');
    const lista = document.getElementById('origenesLista');
    lista.innerHTML = data.length ? data.map(o => `
      <div class="d-flex items-center justify-between p-2-3 radius-sm" style="background:var(--color-fog)">
        <span class="text-sm">${o.nombre}</span>
        <button class="btn btn--sm btn--danger btn--icon size-28" data-action="eliminar-origen" data-id="${o.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>`).join('') : '<p class="text-sm text-muted">Sin orígenes registrados</p>';
    lista.querySelectorAll('[data-action="eliminar-origen"]').forEach(btn =>
      btn.addEventListener('click', async () => {
        try {
          await api.delete(`/maestros/origenes/${btn.dataset.id}`);
          window.AdminToast?.success('Origen eliminado');
          await loadOrigenes();
        } catch (err) { window.AdminToast?.error('Error', err.message); }
      })
    );
  } catch (err) { window.AdminToast?.error('Error', 'No se pudieron cargar los orígenes'); }
}

/* ─── CONCEPTOS ───────────────────────────────────────────── */
async function loadConceptos() {
  try {
    const data = await api.get('/maestros/conceptos');
    const lista = document.getElementById('conceptosLista');
    lista.innerHTML = data.length ? data.map(c => `
      <div class="d-flex items-center justify-between p-2-3 radius-sm" style="background:var(--color-fog)">
        <span class="text-sm">${c.nombre}</span>
        <button class="btn btn--sm btn--danger btn--icon size-28" data-action="eliminar-concepto" data-id="${c.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>`).join('') : '<p class="text-sm text-muted">Sin conceptos registrados</p>';
    lista.querySelectorAll('[data-action="eliminar-concepto"]').forEach(btn =>
      btn.addEventListener('click', async () => {
        try {
          await api.delete(`/maestros/conceptos/${btn.dataset.id}`);
          window.AdminToast?.success('Concepto eliminado');
          await loadConceptos();
        } catch (err) { window.AdminToast?.error('Error', err.message); }
      })
    );
  } catch (err) { window.AdminToast?.error('Error', 'No se pudieron cargar los conceptos'); }
}

document.addEventListener('DOMContentLoaded', () => {
  window.AdminAuth.populateUserInfo(session);

  /* ── Filtrar sección por URL ── */
  const seccion = new URLSearchParams(window.location.search).get('seccion') || 'general';
  const titulos = {
    general:   'Configuración general',
    seguridad: 'Seguridad',
    usuarios:  'Usuarios',
    maestros:  'Maestros',
  };
  window.AdminLayout.init(titulos[seccion] || 'Configuración');

  document.querySelectorAll('[data-seccion]').forEach(panel => {
    panel.style.display = panel.dataset.seccion === seccion ? '' : 'none';
  });

  if (seccion === 'general' || seccion === 'maestros') loadCatalogo();
  if (seccion === 'usuarios') {
    api.get('/usuarios').then(d => window._usuariosCache = d);
    loadUsuarios();
  }
  if (seccion === 'maestros') { loadOrigenes(); loadConceptos(); }

  document.getElementById('btnNuevoUsuario')?.addEventListener('click', () => abrirModalUsuario(null));

  document.getElementById('btnGuardarUsuario')?.addEventListener('click', async () => {
    const nombre  = document.getElementById('uNombre')?.value.trim();
    const celular = document.getElementById('uCelular')?.value.trim();
    if (!celular) { window.AdminToast?.error('Campo requerido', 'El celular es obligatorio'); return; }
    const rol    = document.getElementById('uRol')?.value;
    if (!nombre) { window.AdminToast?.error('Campo requerido', 'El nombre es obligatorio'); return; }
    if (!rol)    { window.AdminToast?.error('Campo requerido', 'Selecciona un rol'); return; }
    const body = {
      nombre, rol,
      celular:      document.getElementById('uCelular')?.value.trim() || null,
      email:        document.getElementById('uEmail')?.value.trim() || null,
    };
    if (!editandoUsuarioId) {
      const pass = document.getElementById('uPassword')?.value;
      if (!pass) { window.AdminToast?.error('Campo requerido', 'La contraseña es obligatoria'); return; }
      body.password = pass;
    } else {
      body.activo = document.getElementById('uActivo')?.value === 'true';
    }
    try {
      if (editandoUsuarioId) await api.put('/usuarios/' + editandoUsuarioId, body);
      else await api.post('/usuarios', body);
      window.AdminToast?.success(editandoUsuarioId ? 'Usuario actualizado' : 'Usuario creado');
      window.AdminModal.close('modalUsuario');
      await loadUsuarios();
      api.get('/usuarios').then(d => window._usuariosCache = d);
    } catch (err) { window.AdminToast?.error('Error', err.message); }
  });

  document.getElementById('btnAgregarOrigen')?.addEventListener('click', async () => {
    const nombre = document.getElementById('nuevoOrigenInput')?.value.trim();
    if (!nombre) { window.AdminToast?.error('Campo requerido', 'Ingresa un origen'); return; }
    try {
      await api.post('/maestros/origenes', { nombre });
      document.getElementById('nuevoOrigenInput').value = '';
      window.AdminToast?.success('Origen agregado');
      await loadOrigenes();
    } catch (err) { window.AdminToast?.error('Error', err.message); }
  });

  document.getElementById('btnAgregarConcepto')?.addEventListener('click', async () => {
    const nombre = document.getElementById('nuevoConceptoInput')?.value.trim();
    if (!nombre) { window.AdminToast?.error('Campo requerido', 'Ingresa un concepto'); return; }
    try {
      await api.post('/maestros/conceptos', { nombre });
      document.getElementById('nuevoConceptoInput').value = '';
      window.AdminToast?.success('Concepto agregado');
      await loadConceptos();
    } catch (err) { window.AdminToast?.error('Error', err.message); }
  });
  document.getElementById('btnNuevoProductoCat')?.addEventListener('click', () => {
    document.getElementById('ncpNombre').value = '';
    window.AdminModal.open('modalNuevoProductoCat');
    document.getElementById('ncpNombre').focus();
  });

  async function guardarNuevoProductoCat() {
    const nombre = document.getElementById('ncpNombre')?.value;
    if (!nombre?.trim()) return;
    try {
      await api.post('/catalogo', { nombre: nombre.trim() });
      window.AdminToast?.success('Producto creado');
      window.AdminModal.close('modalNuevoProductoCat');
      await loadCatalogo();
    } catch (err) {
      window.AdminToast?.error('Error', err.message);
    }
  }
  document.getElementById('btnGuardarNuevoProductoCat')?.addEventListener('click', guardarNuevoProductoCat);
  document.getElementById('ncpNombre')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') guardarNuevoProductoCat();
  });
});
