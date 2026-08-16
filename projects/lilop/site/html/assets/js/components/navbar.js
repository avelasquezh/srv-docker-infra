/* ============================================================
   Lilop — components/navbar.js
   Web Component: <lilop-navbar>
   Responsabilidad única: renderizar y gestionar el navbar.
   - Renderiza topbar + navbar completos
   - Actualiza contador del carrito escuchando el store
   - Maneja menú móvil (abrir/cerrar)
   - Marca el link activo según la página actual
   - Maneja búsqueda expandible con redirección al catálogo
   - Aplica clase is-scrolled al hacer scroll
   ============================================================ */

class LilopNavbar extends HTMLElement {

  connectedCallback() {
    this.render();
    this.initScrollBehavior();
    this.initMobileMenu();
    this.initSearch();
    this.initCartButton();
    this.updateCartCount(window.LilopStore?.getCount() || 0);
    this.markActiveLink();

    /* Escuchar cambios en el carrito */
    window.addEventListener('lilop:cart:updated', (e) => {
      this.updateCartCount(e.detail.count);
    });
  }

  /* ─── TEMPLATE HTML ─────────────────────────────────────── */
  render() {
    this.innerHTML = `
      <!-- TOP BAR -->
      <div class="topbar" role="marquee" aria-label="Anuncios">
        <div class="topbar__track" aria-hidden="true">
          <!-- Bloque original -->
          <span class="topbar__item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            Envío gratis en pedidos mayores a $200.000
          </span>
          <span class="topbar__item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Pago 100% seguro con MercadoPago
          </span>
          <span class="topbar__item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Garantía de calidad en todos nuestros productos
          </span>
          <span class="topbar__item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 17"/>
            </svg>
            Atención por WhatsApp: lunes a sábado 8am–7pm
          </span>
          <!-- Bloque duplicado para loop continuo -->
          <span class="topbar__item" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            Envío gratis en pedidos mayores a $200.000
          </span>
          <span class="topbar__item" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Pago 100% seguro con MercadoPago
          </span>
          <span class="topbar__item" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Garantía de calidad en todos nuestros productos
          </span>
          <span class="topbar__item" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 17"/>
            </svg>
            Atención por WhatsApp: lunes a sábado 8am–7pm
          </span>
        </div>
      </div>

      <!-- NAVBAR -->
      <nav class="navbar" role="navigation" aria-label="Navegación principal">
        <div class="navbar__inner">

          <!-- Logo -->
          <a href="/index.html" class="navbar__logo" aria-label="Lilop — Ir al inicio">
            Lilop - Ropa de Cama
          </a>

          <!-- Links de navegación (desktop) -->
          <ul class="navbar__nav" role="list">
            <li>
              <a href="/index.html"
                 class="navbar__link"
                 data-page="index.html"
                 aria-label="Inicio">
                Inicio
              </a>
            </li>
            <li>
              <a href="/catalogo.html"
                 class="navbar__link"
                 data-page="catalogo.html"
                 aria-label="Ver catálogo completo">
                Catálogo
              </a>
            </li>
            <li>
              <a href="/catalogo.html?categoria=sabanas"
                 class="navbar__link"
                 aria-label="Ver sábanas">
                Sábanas
              </a>
            </li>
            <li>
              <a href="/catalogo.html?categoria=edredones"
                 class="navbar__link"
                 aria-label="Ver edredones">
                Edredones
              </a>
            </li>
            <li>
              <a href="/nosotros.html"
                 class="navbar__link"
                 data-page="nosotros.html"
                 aria-label="Sobre Lilop">
                Nosotros
              </a>
            </li>
          </ul>

          <!-- Acciones (búsqueda, carrito) -->
          <div class="navbar__actions">

            <!-- Búsqueda -->
            <div class="navbar__search-wrap">
              <input
                type="search"
                class="navbar__search-input"
                id="navSearchInput"
                placeholder="Buscar productos..."
                aria-label="Buscar productos"
                autocomplete="off"
              />
              <button
                class="navbar__action-btn"
                id="navSearchBtn"
                aria-label="Abrir búsqueda"
                aria-expanded="false"
                aria-controls="navSearchInput"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <circle cx="11" cy="11" r="7"/>
                  <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <!-- Carrito -->
            <button
              class="navbar__action-btn"
              id="navCartBtn"
              aria-label="Abrir carrito"
              aria-haspopup="dialog"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              <span class="navbar__cart-count" id="navCartCount" aria-live="polite" aria-label="Productos en el carrito">0</span>
            </button>

            <!-- Hamburger (móvil) -->
            <button
              class="navbar__hamburger"
              id="navHamburger"
              aria-label="Abrir menú de navegación"
              aria-expanded="false"
              aria-controls="navMobileMenu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>

          </div><!-- /navbar__actions -->
        </div><!-- /navbar__inner -->
      </nav>

      <!-- MENÚ MÓVIL -->
      <div
        class="navbar__mobile-menu"
        id="navMobileMenu"
        role="dialog"
        aria-label="Menú de navegación"
        aria-hidden="true"
      >
        <a href="/index.html"     class="navbar__mobile-link" data-page="index.html">Inicio</a>
        <a href="/catalogo.html"  class="navbar__mobile-link" data-page="catalogo.html">Catálogo</a>
        <a href="/catalogo.html?categoria=sabanas"    class="navbar__mobile-link">Sábanas</a>
        <a href="/catalogo.html?categoria=edredones"  class="navbar__mobile-link">Edredones</a>
        <a href="/catalogo.html?categoria=almohadas"  class="navbar__mobile-link">Almohadas</a>
        <a href="/catalogo.html?categoria=toallas"    class="navbar__mobile-link">Toallas</a>
        <a href="/nosotros.html"  class="navbar__mobile-link" data-page="nosotros.html">Nosotros</a>
        <a href="/contacto.html"  class="navbar__mobile-link" data-page="contacto.html">Contacto</a>
        <hr style="border:none;border-top:1px solid var(--color-border);margin:8px 0;">
        <a href="/catalogo.html"  class="btn btn--primary btn--full" style="margin-top:4px;">
          Ver catálogo completo
        </a>
      </div>
    `;
  }

  /* ─── SCROLL BEHAVIOR ───────────────────────────────────── */
  initScrollBehavior() {
    const navbar = this.querySelector('.navbar');
    if (!navbar) return;

    const onScroll = () => {
      navbar.classList.toggle('is-scrolled', window.scrollY > 20);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); /* estado inicial */
  }

  /* ─── MENÚ MÓVIL ────────────────────────────────────────── */
  initMobileMenu() {
    const hamburger  = this.querySelector('#navHamburger');
    const mobileMenu = this.querySelector('#navMobileMenu');
    const overlay    = document.querySelector('.overlay');
    if (!hamburger || !mobileMenu) return;

    const open = () => {
      hamburger.classList.add('is-open');
      mobileMenu.classList.add('is-open');
      hamburger.setAttribute('aria-expanded', 'true');
      mobileMenu.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      overlay?.classList.add('is-open');
    };

    const close = () => {
      hamburger.classList.remove('is-open');
      mobileMenu.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      overlay?.classList.remove('is-open');
    };

    hamburger.addEventListener('click', () => {
      hamburger.classList.contains('is-open') ? close() : open();
    });

    /* Cerrar al hacer click en overlay */
    overlay?.addEventListener('click', close);

    /* Cerrar al hacer click en un link del menú móvil */
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', close);
    });

    /* Cerrar con tecla Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  /* ─── BÚSQUEDA ──────────────────────────────────────────── */
  initSearch() {
    const searchBtn   = this.querySelector('#navSearchBtn');
    const searchInput = this.querySelector('#navSearchInput');
    if (!searchBtn || !searchInput) return;

    let isOpen = false;

    const openSearch = () => {
      isOpen = true;
      searchInput.classList.add('is-open');
      searchBtn.setAttribute('aria-expanded', 'true');
      searchBtn.setAttribute('aria-label', 'Cerrar búsqueda');
      setTimeout(() => searchInput.focus(), 50);
    };

    const closeSearch = () => {
      isOpen = false;
      searchInput.classList.remove('is-open');
      searchInput.value = '';
      searchBtn.setAttribute('aria-expanded', 'false');
      searchBtn.setAttribute('aria-label', 'Abrir búsqueda');
    };

    searchBtn.addEventListener('click', () => {
      isOpen ? closeSearch() : openSearch();
    });

    /* Buscar al presionar Enter → redirige al catálogo */
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          window.LilopRouter?.navigateTo('catalogo.html', { buscar: query });
        }
      }
      if (e.key === 'Escape') closeSearch();
    });

    /* Cerrar al hacer click fuera */
    document.addEventListener('click', (e) => {
      if (isOpen && !this.contains(e.target)) closeSearch();
    });
  }

  /* ─── BOTÓN CARRITO ─────────────────────────────────────── */
  initCartButton() {
    const cartBtn = this.querySelector('#navCartBtn');
    if (!cartBtn) return;

    cartBtn.addEventListener('click', () => {
      /* Emite evento para que cart.js abra el drawer */
      window.dispatchEvent(new CustomEvent('lilop:cart:open'));
    });
  }

  /* ─── CONTADOR DEL CARRITO ──────────────────────────────── */
  updateCartCount(count) {
    const badge = this.querySelector('#navCartCount');
    if (!badge) return;
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.toggle('is-visible', count > 0);
    badge.setAttribute('aria-label', `${count} producto${count !== 1 ? 's' : ''} en el carrito`);
  }

  /* ─── LINK ACTIVO ───────────────────────────────────────── */
  markActiveLink() {
    const current = window.LilopRouter?.currentPage() || '';
    this.querySelectorAll('[data-page]').forEach(link => {
      const isActive = link.dataset.page === current;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
    });
  }
}

customElements.define('lilop-navbar', LilopNavbar);