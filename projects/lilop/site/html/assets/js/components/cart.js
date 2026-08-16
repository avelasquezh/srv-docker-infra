/* ============================================================
   Lilop — components/cart.js
   Web Component: <lilop-cart>
   Responsabilidad única: drawer lateral del carrito.
   - Renderiza el overlay y el drawer
   - Escucha eventos del store para re-renderizar
   - Controles de cantidad y eliminar por item
   - Botones: seguir comprando, ir al carrito, ir a pagar
   ============================================================ */

class LilopCart extends HTMLElement {

  connectedCallback() {
    this.render();
    this.initOverlay();
    this.listenToStore();
    this.listenToOpenEvent();
    this.renderItems();
  }

  /* ─── TEMPLATE BASE ─────────────────────────────────────── */
  render() {
    this.innerHTML = `
      <!-- Overlay -->
      <div class="overlay" id="cartOverlay" aria-hidden="true"></div>

      <!-- Drawer -->
      <aside
        class="cart-drawer"
        id="cartDrawer"
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        aria-hidden="true"
      >
        <!-- Header -->
        <div class="cart-drawer__header">
          <div>
            <h2 class="cart-drawer__title">Tu carrito</h2>
            <span class="cart-drawer__count" id="cartDrawerCount" aria-live="polite"></span>
          </div>
          <button
            class="cart-drawer__close"
            id="cartDrawerClose"
            aria-label="Cerrar carrito"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Cuerpo (items se inyectan aquí) -->
        <div class="cart-drawer__body" id="cartDrawerBody" role="list" aria-label="Productos en el carrito">
        </div>

        <!-- Footer (solo visible con items) -->
        <div class="cart-drawer__footer" id="cartDrawerFooter" style="display:none;">
          <div class="cart-subtotal">
            <span class="cart-subtotal__label">Subtotal</span>
            <span class="cart-subtotal__amount" id="cartDrawerTotal"></span>
          </div>
          <p class="cart-shipping-note">
            Envío calculado en el siguiente paso
          </p>
          <a href="/checkout.html" class="btn btn--primary btn--full" id="cartCheckoutBtn">
            Ir a pagar
          </a>
          <a href="/carrito.html" class="btn btn--outline btn--full">
            Ver carrito completo
          </a>
        </div>

      </aside>
    `;

    /* Bind del botón cerrar */
    this.querySelector('#cartDrawerClose')
      ?.addEventListener('click', () => this.close());
  }

  /* ─── OVERLAY ───────────────────────────────────────────── */
  initOverlay() {
    const overlay = this.querySelector('#cartOverlay');
    overlay?.addEventListener('click', () => this.close());
  }

  /* ─── ABRIR / CERRAR ────────────────────────────────────── */
  open() {
    const drawer  = this.querySelector('#cartDrawer');
    const overlay = this.querySelector('#cartOverlay');
    if (!drawer) return;

    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay?.classList.add('is-open');
    overlay?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    /* Focus trap: primer elemento interactivo */
    setTimeout(() => {
      drawer.querySelector('button, a, [tabindex]')?.focus();
    }, 50);
  }

  close() {
    const drawer  = this.querySelector('#cartDrawer');
    const overlay = this.querySelector('#cartOverlay');
    if (!drawer) return;

    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay?.classList.remove('is-open');
    overlay?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ─── ESCUCHAR EVENTO DE APERTURA DESDE NAVBAR ──────────── */
  listenToOpenEvent() {
    window.addEventListener('lilop:cart:open', () => this.open());

    /* Cerrar con Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  /* ─── ESCUCHAR CAMBIOS DEL STORE ────────────────────────── */
  listenToStore() {
    window.addEventListener('lilop:cart:updated', () => {
      this.renderItems();
    });
  }

  /* ─── RENDER DE ITEMS ───────────────────────────────────── */
  renderItems() {
    const store  = window.LilopStore;
    if (!store) return;

    const cart   = store.getCart();
    const body   = this.querySelector('#cartDrawerBody');
    const footer = this.querySelector('#cartDrawerFooter');
    const count  = this.querySelector('#cartDrawerCount');
    const total  = this.querySelector('#cartDrawerTotal');
    if (!body) return;

    /* Actualizar contador y total */
    const itemCount = store.getCount();
    if (count) {
      count.textContent = itemCount === 0
        ? ''
        : `${itemCount} producto${itemCount !== 1 ? 's' : ''}`;
    }

    if (total) total.textContent = store.formatPrice(store.getTotal());

    /* Mostrar/ocultar footer */
    if (footer) footer.style.display = cart.length > 0 ? 'flex' : 'none';

    /* Carrito vacío */
    if (cart.length === 0) {
      body.innerHTML = `
        <div class="cart-empty" role="status">
          <div class="cart-empty__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          </div>
          <p class="cart-empty__title">Tu carrito está vacío</p>
          <p class="cart-empty__desc">Agrega productos para comenzar tu pedido</p>
          <button class="btn btn--primary" id="cartContinueBtn" style="margin-top:8px;">
            Ver catálogo
          </button>
        </div>
      `;
      this.querySelector('#cartContinueBtn')
        ?.addEventListener('click', () => {
          this.close();
          window.LilopRouter?.navigateTo('catalogo.html');
        });
      return;
    }

    /* Renderizar items */
    body.innerHTML = cart.map((item, index) => `
      <article class="cart-item" role="listitem" data-index="${index}">
        <div class="cart-item__img">
          <img
            src="${item.image || '/assets/img/placeholder.jpg'}"
            alt="${item.name}"
            loading="lazy"
            onerror="this.src='/assets/img/placeholder.jpg'"
          />
        </div>
        <div class="cart-item__info">
          <p class="cart-item__name">${item.name}</p>
          ${item.variant ? `<p class="cart-item__variant">${item.variant}</p>` : ''}
          <p class="cart-item__price">${store.formatPrice(item.price * item.quantity)}</p>
          <div class="cart-item__actions">
            <div class="qty-control" role="group" aria-label="Cantidad de ${item.name}">
              <button
                class="qty-control__btn"
                data-action="decrease"
                data-index="${index}"
                aria-label="Reducir cantidad"
              >−</button>
              <span class="qty-control__val" aria-live="polite">${item.quantity}</span>
              <button
                class="qty-control__btn"
                data-action="increase"
                data-index="${index}"
                aria-label="Aumentar cantidad"
              >+</button>
            </div>
            <button
              class="cart-item__remove"
              data-action="remove"
              data-index="${index}"
              aria-label="Eliminar ${item.name} del carrito"
            >
              Eliminar
            </button>
          </div>
        </div>
      </article>
    `).join('');

    /* Eventos de los botones de cada item */
    body.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const idx    = parseInt(btn.dataset.index, 10);
        const item   = cart[idx];

        if (action === 'increase') {
          store.updateQuantity(idx, item.quantity + 1);
        } else if (action === 'decrease') {
          store.updateQuantity(idx, item.quantity - 1);
        } else if (action === 'remove') {
          store.removeFromCart(idx);
        }
      });
    });
  }
}

customElements.define('lilop-cart', LilopCart);