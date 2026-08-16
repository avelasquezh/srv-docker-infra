/* ============================================================
   Lilop — pages/carrito.js
   Responsabilidad única: lógica de la página de carrito.
   - Renderiza todos los items del carrito con imagen,
     nombre, variante, precio unitario y total por item
   - Controles de cantidad (+ / −) con actualización
     inmediata en el store y en el resumen
   - Botón eliminar item con animación de salida
   - Botón vaciar carrito completo
   - Resumen dinámico: subtotal, envío, total
   - Indicador de progreso hacia envío gratis ($200.000)
   - Estado vacío con CTA al catálogo
   - Botón "Proceder al pago" activo solo con items
   ============================================================ */

'use strict';

const store  = window.LilopStore;
const router = window.LilopRouter;

const FREE_SHIPPING_THRESHOLD = 200000;

/* ─── RENDERIZAR ESTADO VACÍO ─────────────────────────────── */
function renderEmpty() {
  const section = document.getElementById('cartItemsSection');
  const summary = document.getElementById('orderSummary');
  const count   = document.getElementById('cartPageCount');

  if (summary) summary.style.display = 'none';
  if (count)   count.innerHTML = '';

  if (!section) return;

  section.innerHTML = `
    <div class="cart-empty-page" role="status" aria-live="polite">
      <div class="cart-empty-page__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
      </div>
      <h2 class="cart-empty-page__title">Tu carrito está vacío</h2>
      <p class="cart-empty-page__desc">
        Aún no has agregado ningún producto.<br/>
        Explora nuestra colección y encuentra algo que ames.
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        <a href="/catalogo.html" class="btn btn--primary btn--lg">
          Explorar catálogo
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round"/>
          </svg>
        </a>
        <a href="/index.html" class="btn btn--outline btn--lg">Ir al inicio</a>
      </div>
    </div>
  `;
}

/* ─── RENDERIZAR ITEMS ────────────────────────────────────── */
function renderItems() {
  const cart    = store.getCart();
  const section = document.getElementById('cartItemsSection');
  const count   = document.getElementById('cartPageCount');
  const summary = document.getElementById('orderSummary');

  if (!section) return;

  if (!cart.length) {
    renderEmpty();
    return;
  }

  /* Mostrar resumen */
  if (summary) summary.style.display = 'block';

  /* Contador */
  const total = store.getCount();
  if (count) {
    count.innerHTML = `<strong>${total}</strong> producto${total !== 1 ? 's' : ''} en tu carrito`;
  }

  /* Header de la sección */
  const headerHTML = `
    <div class="cart-items-section__header">
      <span class="cart-items-section__title">
        ${cart.length} producto${cart.length !== 1 ? 's' : ''}
      </span>
      <button
        class="cart-items-section__clear"
        id="clearCartBtn"
        aria-label="Vaciar todo el carrito"
      >
        Vaciar carrito
      </button>
    </div>
  `;

  /* Items */
  const itemsHTML = cart.map((item, index) => `
    <div
      class="cart-page-item"
      data-index="${index}"
      role="listitem"
      aria-label="${item.name}${item.variant ? ', ' + item.variant : ''}"
    >
      <!-- Imagen -->
      <div class="cart-page-item__img">
        <img
          src="${item.image || '/assets/img/placeholder.jpg'}"
          alt="${item.name}"
          loading="lazy"
          onerror="this.src='/assets/img/placeholder.jpg'"
        />
      </div>

      <!-- Info -->
      <div class="cart-page-item__info">
        <p class="cart-page-item__name">${item.name}</p>
        ${item.variant
          ? `<p class="cart-page-item__variant">${item.variant}</p>`
          : ''}
        <p class="cart-page-item__unit-price">
          Precio unitario: ${store.formatPrice(item.price)}
        </p>
        <div class="cart-page-item__controls">
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
        </div>
      </div>

      <!-- Precio total + eliminar -->
      <div class="cart-page-item__right">
        <span class="cart-page-item__total">
          ${store.formatPrice(item.price * item.quantity)}
        </span>
        <button
          class="cart-page-item__remove"
          data-action="remove"
          data-index="${index}"
          aria-label="Eliminar ${item.name} del carrito"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
          Eliminar
        </button>
      </div>
    </div>
  `).join('');

  section.innerHTML = headerHTML + `
    <div role="list" aria-label="Productos en tu carrito" id="cartItemsList">
      ${itemsHTML}
    </div>
  `;

  /* Eventos de cantidad y eliminar */
  section.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const idx    = parseInt(btn.dataset.index, 10);
      const item   = store.getCart()[idx];

      if (action === 'increase') {
        store.updateQuantity(idx, item.quantity + 1);
        renderPage();
      } else if (action === 'decrease') {
        if (item.quantity <= 1) {
          removeItemWithAnimation(btn.closest('.cart-page-item'), idx);
        } else {
          store.updateQuantity(idx, item.quantity - 1);
          renderPage();
        }
      } else if (action === 'remove') {
        removeItemWithAnimation(btn.closest('.cart-page-item'), idx);
      }
    });
  });

  /* Vaciar carrito */
  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    if (confirm('¿Seguro que quieres vaciar el carrito?')) {
      store.clearCart();
      renderPage();
    }
  });

  /* Actualizar resumen */
  updateSummary();
}

/* ─── ELIMINAR ITEM CON ANIMACIÓN ─────────────────────────── */
function removeItemWithAnimation(itemEl, idx) {
  if (!itemEl) {
    store.removeFromCart(idx);
    renderPage();
    return;
  }
  itemEl.classList.add('is-removing');
  itemEl.addEventListener('animationend', () => {
    store.removeFromCart(idx);
    renderPage();
  }, { once: true });
}

/* ─── ACTUALIZAR RESUMEN ──────────────────────────────────── */
function updateSummary() {
  const cart          = store.getCart();
  const subtotal      = store.getTotal();
  const count         = store.getCount();
  const freeShipping  = subtotal >= FREE_SHIPPING_THRESHOLD;
  const remaining     = FREE_SHIPPING_THRESHOLD - subtotal;

  const labelEl    = document.getElementById('summaryItemsLabel');
  const subtotalEl = document.getElementById('summarySubtotal');
  const shippingEl = document.getElementById('summaryShipping');
  const totalEl    = document.getElementById('summaryTotal');
  const freeEl     = document.getElementById('summaryFreeShipping');
  const progressEl = document.getElementById('summaryShippingProgress');
  const progressTx = document.getElementById('summaryProgressText');

  if (labelEl)    labelEl.textContent    = `Productos (${count})`;
  if (subtotalEl) subtotalEl.textContent = store.formatPrice(subtotal);
  if (totalEl)    totalEl.textContent    = store.formatPrice(subtotal);

  if (freeShipping) {
    if (shippingEl)  shippingEl.textContent  = 'Gratis';
    if (freeEl)      freeEl.style.display     = 'flex';
    if (progressEl)  progressEl.style.display = 'none';
  } else {
    if (shippingEl)  shippingEl.textContent  = 'Por calcular';
    if (freeEl)      freeEl.style.display     = 'none';
    if (progressEl)  progressEl.style.display = 'flex';
    if (progressTx)  progressTx.textContent   =
      `Agrega ${store.formatPrice(remaining)} más para obtener envío gratis`;
  }
}

/* ─── RENDER COMPLETO ─────────────────────────────────────── */
function renderPage() {
  renderItems();
}

/* ─── ESCUCHAR CAMBIOS DEL STORE ──────────────────────────── */
function listenToStore() {
  /* La página ya re-renderiza en cada acción directa,
     pero escuchamos por si el carrito cambia desde otro tab */
  window.addEventListener('storage', (e) => {
    if (e.key === 'lilop_cart') renderPage();
  });
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderPage();
  listenToStore();
});