/* ============================================================
   Lilop — components/toast.js
   Web Component: <lilop-toast>
   Responsabilidad única: mostrar notificaciones flotantes.
   - Se auto-instancia al conectarse al DOM
   - Escucha eventos del store para disparar toasts automáticos
   - API pública: window.LilopToast.show(options)
   - Los toasts se auto-destruyen después de 4 segundos
   - El usuario puede cerrarlos manualmente
   ============================================================ */

class LilopToast extends HTMLElement {

  connectedCallback() {
    /* Contenedor donde viven los toasts */
    this.innerHTML = `
      <div
        class="toast-container"
        id="toastContainer"
        role="region"
        aria-live="polite"
        aria-label="Notificaciones"
      ></div>
    `;

    this.container = this.querySelector('#toastContainer');
    this.listenToStore();
    this.exposeAPI();
  }

  /* ─── ESCUCHAR EVENTOS DEL STORE ────────────────────────── */
  listenToStore() {
    /* Producto agregado al carrito */
    window.addEventListener('lilop:cart:item-added', (e) => {
      this.show({
        type:    'success',
        title:   '¡Agregado al carrito!',
        message: e.detail.item?.name || 'Producto agregado correctamente',
      });
    });

    /* Item eliminado */
    window.addEventListener('lilop:cart:item-removed', () => {
      this.show({
        type:    'info',
        title:   'Producto eliminado',
        message: 'El producto fue removido del carrito',
      });
    });

    /* Carrito vaciado */
    window.addEventListener('lilop:cart:cleared', () => {
      this.show({
        type:    'info',
        title:   'Carrito vaciado',
        message: 'Se eliminaron todos los productos del carrito',
      });
    });
  }

  /* ─── EXPONER API GLOBAL ────────────────────────────────── */
  exposeAPI() {
    window.LilopToast = {
      show:    (opts) => this.show(opts),
      success: (title, message) => this.show({ type: 'success', title, message }),
      error:   (title, message) => this.show({ type: 'error',   title, message }),
      warning: (title, message) => this.show({ type: 'warning', title, message }),
      info:    (title, message) => this.show({ type: 'info',    title, message }),
    };
  }

  /* ─── ICONOS POR TIPO ───────────────────────────────────── */
  getIcon(type) {
    const icons = {
      success: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>`,
      error: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>`,
      warning: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>`,
      info: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>`,
    };
    return icons[type] || icons.info;
  }

  /* ─── MOSTRAR UN TOAST ──────────────────────────────────── */
  /**
   * @param {Object} options
   * @param {'success'|'error'|'warning'|'info'} options.type
   * @param {string} options.title
   * @param {string} [options.message]
   * @param {number} [options.duration]  - ms antes de desaparecer (default: 4000)
   */
  show({ type = 'info', title, message, duration = 4000 }) {
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-atomic', 'true');

    toast.innerHTML = `
      ${this.getIcon(type)}
      <div class="toast__content">
        <p class="toast__title">${title}</p>
        ${message ? `<p class="toast__message">${message}</p>` : ''}
      </div>
      <button class="toast__close" aria-label="Cerrar notificación">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    /* Botón de cierre */
    toast.querySelector('.toast__close')
      ?.addEventListener('click', () => this.dismiss(toast));

    /* Agregar al DOM */
    this.container.appendChild(toast);

    /* Auto-cerrar */
    const timer = setTimeout(() => this.dismiss(toast), duration);

    /* Cancelar auto-cierre si el usuario hace hover */
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
      setTimeout(() => this.dismiss(toast), 1500);
    });
  }

  /* ─── DISMISS CON ANIMACIÓN ─────────────────────────────── */
  dismiss(toast) {
    if (!toast || toast.classList.contains('is-removing')) return;
    toast.classList.add('is-removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }
}

customElements.define('lilop-toast', LilopToast);