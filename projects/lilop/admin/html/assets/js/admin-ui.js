/* ============================================================
   Lilop Admin — admin-ui.js
   Componentes UI reutilizables: toast, modal, sidebar,
   confirmación de borrado, topbar.
   ============================================================ */

'use strict';

/* ─── TOAST ───────────────────────────────────────────────── */
const AdminToast = {
  container: null,

  init() {
    this.container = document.getElementById('adminToasts');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'admin-toasts';
      this.container.id = 'adminToasts';
      document.body.appendChild(this.container);
    }
  },

  show(type, title, desc = '', duration = 4000) {
    if (!this.container) this.init();
    const icons = {
      success: '<polyline points="20 6 9 17 4 12"/>',
      error:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
      info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
      warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    };
    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast--${type}`;
    toast.innerHTML = `
      <div class="admin-toast__icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[type] || icons.info}</svg>
      </div>
      <div class="admin-toast__text">
        <p class="admin-toast__title">${title}</p>
        ${desc ? `<p class="admin-toast__desc">${desc}</p>` : ''}
      </div>
    `;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  },

  success: (title, desc) => AdminToast.show('success', title, desc),
  error:   (title, desc) => AdminToast.show('error',   title, desc),
  info:    (title, desc) => AdminToast.show('info',    title, desc),
  warning: (title, desc) => AdminToast.show('warning', title, desc),
};

/* ─── MODAL ───────────────────────────────────────────────── */
const AdminModal = {
  open(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) AdminModal.close(id);
    }, { once: true });
  },

  close(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  },

  closeAll() {
    document.querySelectorAll('.modal-overlay.is-open').forEach(o => {
      o.classList.remove('is-open');
    });
    document.body.style.overflow = '';
  },
};

/* ─── CONFIRMAR BORRADO ───────────────────────────────────── */
const AdminConfirm = {
  show(message, onConfirm) {
    const existing = document.getElementById('confirmModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay is-open';
    overlay.id = 'confirmModal';
    overlay.innerHTML = `
      <div class="modal modal--sm">
        <div class="modal__header">
          <h3 class="modal__title">Confirmar acción</h3>
          <button class="modal__close" id="confirmClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal__body">
          <p class="text-sm text-muted" style="line-height:var(--leading-relaxed)">${message}</p>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost btn--sm" id="confirmCancel">Cancelar</button>
          <button class="btn btn--danger btn--sm" id="confirmOk">Eliminar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const close = () => {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => overlay.remove(), 300);
    };

    document.getElementById('confirmClose').addEventListener('click', close);
    document.getElementById('confirmCancel').addEventListener('click', close);
    document.getElementById('confirmOk').addEventListener('click', () => {
      close();
      onConfirm();
    });
  },
};

/* ─── SIDEBAR MÓVIL ───────────────────────────────────────── */
function initSidebar() {
  const menuBtn  = document.getElementById('menuBtn');
  const sidebar  = document.getElementById('adminSidebar');
  const overlay  = document.getElementById('sidebarOverlay');

  const open  = () => { sidebar?.classList.add('is-open'); overlay?.classList.add('is-open'); document.body.style.overflow = 'hidden'; };
  const close = () => { sidebar?.classList.remove('is-open'); overlay?.classList.remove('is-open'); document.body.style.overflow = ''; };

  menuBtn?.addEventListener('click', open);
  overlay?.addEventListener('click', close);
}

/* ─── CERRAR SESIÓN ───────────────────────────────────────── */
function initLogout() {
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', () => {
      AdminConfirm.show('¿Seguro que quieres cerrar sesión?', () => {
        window.AdminAuth?.logout();
      });
    });
  });
}

/* ─── MARCAR NAV ACTIVO ───────────────────────────────────── */
function initActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.admin-nav__item').forEach(item => {
    const href = item.getAttribute('href')?.split('/').pop();
    if (href === current) item.classList.add('is-active');
  });
}

/* ─── INIT GLOBAL ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  AdminToast.init();
  initSidebar();
  initLogout();
  initActiveNav();

  /* Cerrar modales con Escape */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') AdminModal.closeAll();
  });

  /* Botones de cerrar modal */
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) AdminModal.close(modal.id);
    });
  });
});

window.AdminToast   = AdminToast;
window.AdminModal   = AdminModal;
window.AdminConfirm = AdminConfirm;

/* ─── NOTIFICACIONES ──────────────────────────────────────── */
/* Delegación en document: el botón puede crearse después de este
   script (ej. cliente.js lo crea tras un fetch async), así que no
   se busca una sola vez al cargar sino en cada clic. */
(function initNotifications() {
  let dropdown = null;

  function closeDropdown() {
    dropdown?.remove();
    dropdown = null;
  }

  function buildDropdown(btn) {
    const pedidos    = window.AdminStore?.getPedidos() || [];
    const pendientes = pedidos.filter(p => p.estado === 'pendiente');

    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;
      top:${btn.getBoundingClientRect().bottom + 8}px;
      right:16px;
      width:320px;
      background:var(--color-white);
      border:1px solid var(--color-border);
      border-radius:var(--r-xl);
      box-shadow:var(--shadow-xl);
      z-index:var(--z-dropdown);
      overflow:hidden;
    `;

    const header = `
      <div class="d-flex justify-between items-center" style="padding:14px 16px;border-bottom:1px solid var(--color-border)">
        <span class="font-display text-base font-semibold">Notificaciones</span>
        <span class="text-xs text-violet font-semibold">${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}</span>
      </div>
    `;

    const items = pendientes.length
      ? pendientes.slice(0, 5).map(p => `
          <a class="d-flex" href="pedidos.html" style="gap:12px;padding:12px 16px;text-decoration:none;transition:background 150ms;border-bottom:1px solid var(--color-border)" onmouseover="this.style.background='var(--color-fog)'" onmouseout="this.style.background=''">
            <div class="size-36 d-flex items-center justify-center shrink-0" style="border-radius:50%;background:var(--color-warning-bg)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-ink">Pedido ${p.numero}</p>
              <p class="text-xs text-muted" style="margin-top:2px">${p.cliente?.nombre || '—'} · ${window.AdminStore.formatPrice(p.total)}</p>
            </div>
            <span class="text-warning font-semibold radius-pill nowrap" style="font-size:10px;background:var(--color-warning-bg);padding:2px 8px;align-self:center">Pendiente</span>
          </a>
        `).join('')
      : `<div class="text-center text-muted text-sm" style="padding:32px 16px">
           <p>✓ Sin notificaciones pendientes</p>
         </div>`;

    const footer = pendientes.length
      ? `<a class="d-block text-center text-sm font-semibold text-violet" href="pedidos.html" style="padding:12px 16px;text-decoration:none;background:var(--color-fog)">
           Ver todos los pedidos →
         </a>`
      : '';

    el.innerHTML = header + items + footer;
    return el;
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-topbar__btn[aria-label="Notificaciones"]');

    if (btn) {
      e.stopPropagation();
      if (dropdown) { closeDropdown(); return; }
      dropdown = buildDropdown(btn);
      document.body.appendChild(dropdown);
      return;
    }

    if (dropdown) closeDropdown();
  });
})();



/* ── AdminLightbox ─────────────────────────────────────────── */
window.AdminLightbox = (() => {
  let lb, lbScale = 1, lbX = 0, lbY = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0, dragOriginX = 0, dragOriginY = 0;
  let lastPinchDist = null;

  function lbImg() { return document.getElementById('lbImg'); }

  function lbApplyTransform() {
    const img = lbImg();
    if (!img) return;
    img.style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
    img.style.cursor = lbScale > 1 ? 'grab' : 'default';
  }

  function lbReset() {
    lbScale = 1; lbX = 0; lbY = 0;
    lbApplyTransform();
  }

  function lbClose() {
    if (!lb) return;
    lb.style.display = 'none';
    const img = lbImg();
    if (img) img.src = '';
    document.body.style.overflow = '';
    lbReset();
  }

  function open(src) {
    if (!lb) init();
    const img = lbImg();
    if (img) img.src = src;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    lbReset();
  }

  function init() {
    if (document.getElementById('lightbox')) {
      lb = document.getElementById('lightbox');
      return;
    }
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;align-items:center;justify-content:center;overflow:hidden;';
    lb.innerHTML = `
      <button class="pos-absolute cursor-pointer" id="lbClose" style="top:20px;right:24px;background:none;border:none;color:#fff;font-size:2rem;line-height:1;z-index:10001" aria-label="Cerrar">&#x2715;</button>
      <div class="pos-relative d-flex items-center justify-center" id="lbContainer" style="width:100%;height:100%;overflow:hidden">
        <img class="select-none" id="lbImg" src="" alt="" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,0.6);transform-origin:center center;transition:transform 0.1s ease;-webkit-user-drag:none" />
      </div>
    `;
    document.body.appendChild(lb);

    lb.addEventListener('click', e => { if (e.target === lb || e.target.id === 'lbContainer') lbClose(); });
    document.getElementById('lbClose').addEventListener('click', lbClose);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && lb.style.display === 'flex') lbClose(); });

    lb.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      lbScale = Math.min(Math.max(lbScale * delta, 1), 5);
      if (lbScale === 1) { lbX = 0; lbY = 0; }
      lbApplyTransform();
    }, { passive: false });

    lb.addEventListener('mousedown', e => {
      if (lbScale <= 1 || e.target.id === 'lbClose') return;
      isDragging = true;
      dragStartX = e.clientX; dragStartY = e.clientY;
      dragOriginX = lbX; dragOriginY = lbY;
      lbImg().style.cursor = 'grabbing';
      lbImg().style.transition = 'none';
    });
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      lbX = dragOriginX + (e.clientX - dragStartX);
      lbY = dragOriginY + (e.clientY - dragStartY);
      lbApplyTransform();
    });
    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      lbImg().style.cursor = 'grab';
      lbImg().style.transition = 'transform 0.1s ease';
    });

    lb.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      } else if (e.touches.length === 1 && lbScale > 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY;
        dragOriginX = lbX; dragOriginY = lbY;
      }
    }, { passive: true });

    lb.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastPinchDist) {
          const delta = dist / lastPinchDist;
          lbScale = Math.min(Math.max(lbScale * delta, 1), 5);
          if (lbScale === 1) { lbX = 0; lbY = 0; }
          lbApplyTransform();
        }
        lastPinchDist = dist;
      } else if (e.touches.length === 1 && isDragging) {
        lbX = dragOriginX + (e.touches[0].clientX - dragStartX);
        lbY = dragOriginY + (e.touches[0].clientY - dragStartY);
        lbApplyTransform();
      }
    }, { passive: false });

    lb.addEventListener('touchend', e => {
      if (e.touches.length < 2) lastPinchDist = null;
      if (e.touches.length === 0) isDragging = false;
    });

    lb.addEventListener('dblclick', e => {
      if (e.target.id === 'lbClose') return;
      lbScale === 1 ? (lbScale = 2, lbApplyTransform()) : lbReset();
    });
  }

  return { init, open };
})();

/* ── AdminFilterTags ────────────────────────────────────────── */
window.AdminFilterTags = (() => {
  let _config = null;

  function init({ filters, containerId, onClear }) {
    _config = { filters, containerId, onClear };
  }

  function update() {
    if (!_config) return;
    const container = document.getElementById(_config.containerId);
    if (!container) return;

    const tags = _config.filters
      .map(f => {
        const el = document.getElementById(f.id);
        if (!el) return null;
        const val = el.value?.trim();
        if (!val) return null;
        const label = f.type === 'select'
          ? el.options[el.selectedIndex]?.text
          : val;
        return { id: f.id, label: f.label ? f.label + ': ' + label : label, type: f.type };
      })
      .filter(Boolean);

    if (!tags.length) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = tags.map(t => `
      <span style="display:inline-flex;align-items:center;gap:var(--s-1);
            background:var(--color-soft);border:1px solid var(--color-lilac);
            border-radius:var(--r-full);padding:3px var(--s-3);
            font-size:var(--text-xs);color:var(--color-violet);font-weight:var(--weight-medium);">
        ${t.label}
        <button data-clear-filter="${t.id}"
          style="background:none;border:none;cursor:pointer;color:var(--color-violet);
                 display:flex;align-items:center;padding:0;line-height:1;opacity:0.7;"
          aria-label="Eliminar filtro"
          onmouseover="this.style.opacity='1'"
          onmouseout="this.style.opacity='0.7'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </span>
    `).join('');

    container.querySelectorAll('[data-clear-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const el = document.getElementById(btn.dataset.clearFilter);
        if (!el) return;
        el.value = '';
        if (el.type === 'search') el.dispatchEvent(new Event('input'));
        _config.onClear();
        update();
      });
    });
  }

  return { init, update };
})();
