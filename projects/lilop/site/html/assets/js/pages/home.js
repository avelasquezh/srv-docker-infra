/* ============================================================
   Lilop — pages/home.js
   Responsabilidad única: lógica exclusiva del home.
   - Carga y renderiza productos destacados desde products.json
   - Maneja botones "Agregar al carrito" de las tarjetas
   - Inicializa animaciones de scroll reveal
   - Maneja navegación a página de producto al hacer click
   ============================================================ */

'use strict';

/* ─── UTILIDADES ──────────────────────────────────────────── */
const store  = window.LilopStore;
const router = window.LilopRouter;

/* ─── SCROLL REVEAL ───────────────────────────────────────── */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const delay = entry.target.dataset.delay || 0;
      setTimeout(() => {
        entry.target.classList.add('is-visible');
      }, parseInt(delay, 10));
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  elements.forEach((el) => observer.observe(el));
}

/* ─── RENDERIZAR ESTRELLAS ────────────────────────────────── */
function renderStars(rating) {
  const full  = Math.floor(rating);
  const empty = 5 - full;
  const starSVG = `<svg class="product-card__star" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  const emptySVG = `<svg class="product-card__star product-card__star--empty" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  return starSVG.repeat(full) + emptySVG.repeat(empty);
}

/* ─── RENDERIZAR BADGE ────────────────────────────────────── */
function renderBadge(product) {
  if (!product.badge) return '';
  return `<span class="badge badge--${product.badgeType || 'new'}" aria-label="${product.badge}">${product.badge}</span>`;
}

/* ─── RENDERIZAR PRECIO ───────────────────────────────────── */
function renderPrice(product) {
  const current = store.formatPrice(product.price);
  if (!product.originalPrice) {
    return `<span class="product-card__price-current">${current}</span>`;
  }
  const original = store.formatPrice(product.originalPrice);
  return `
    <span class="product-card__price-current">${current}</span>
    <span class="product-card__price-original">${original}</span>
  `;
}

/* ─── TEMPLATE DE TARJETA ─────────────────────────────────── */
function renderProductCard(product, index) {
  return `
    <article
      class="product-card reveal"
      data-delay="${index * 80}"
      data-product-id="${product.id}"
      role="listitem"
      tabindex="0"
      aria-label="${product.name}, ${store.formatPrice(product.price)}"
    >
      <div class="product-card__img-wrap">
        <img
          class="product-card__img"
          src="${product.images[0] || ''}"
          alt="${product.name}"
          loading="lazy"
          onerror="this.src='/assets/img/placeholder.jpg'"
        />
        ${product.badge ? `<div class="product-card__badge">${renderBadge(product)}</div>` : ''}
        <button
          class="product-card__quick-add"
          data-product-id="${product.id}"
          aria-label="Agregar ${product.name} al carrito rápidamente"
        >
          + Agregar al carrito
        </button>
      </div>

      <div class="product-card__info">
        <p class="product-card__category">${product.categoryLabel}</p>
        <h3 class="product-card__name">${product.name}</h3>
        <p class="product-card__short-desc">${product.shortDescription}</p>

        <div class="product-card__footer">
          <div class="product-card__price">
            ${renderPrice(product)}
          </div>
          <div class="product-card__rating" aria-label="${product.rating} de 5 estrellas, ${product.reviewCount} reseñas">
            <div class="product-card__stars">
              ${renderStars(product.rating)}
            </div>
            <span>(${product.reviewCount})</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

/* ─── CARGAR Y RENDERIZAR DESTACADOS ──────────────────────── */
async function loadFeaturedProducts() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;

  try {
    const res      = await fetch('/data/products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const products = await res.json();

    /* Filtrar solo los destacados */
    const featured = products.filter((p) => p.featured);

    if (!featured.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--color-text-muted);">
          No hay productos destacados disponibles.
        </div>
      `;
      return;
    }

    /* Renderizar tarjetas */
    grid.innerHTML = featured.map((p, i) => renderProductCard(p, i)).join('');

    /* Reiniciar scroll reveal para los nuevos elementos */
    initScrollReveal();

    /* Eventos: click en tarjeta → ir a producto */
    grid.querySelectorAll('.product-card').forEach((card) => {
      const goToProduct = (e) => {
        /* Evitar navegación si el click fue en el botón "Agregar" */
        if (e.target.closest('.product-card__quick-add')) return;
        router.navigateTo('producto.html', { id: card.dataset.productId });
      };

      card.addEventListener('click', goToProduct);

      /* Accesibilidad: Enter y Espacio también navegan */
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToProduct(e);
        }
      });
    });

    /* Eventos: botón "Agregar rápido" */
    grid.querySelectorAll('.product-card__quick-add').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); /* No propagar al card */

        const productId = btn.dataset.productId;
        const product   = featured.find((p) => p.id === productId);
        if (!product) return;

        /* Si tiene variantes, ir a la página de producto para seleccionarlas */
        const hasVariants = product.variants &&
          Object.keys(product.variants).length > 0;

        if (hasVariants) {
          router.navigateTo('producto.html', { id: productId });
          return;
        }

        /* Sin variantes: agregar directamente */
        store.addToCart({
          id:      product.id,
          name:    product.name,
          price:   product.price,
          image:   product.images[0],
          variant: '',
        });

        /* Abrir el drawer del carrito */
        window.dispatchEvent(new CustomEvent('lilop:cart:open'));
      });
    });

  } catch (err) {
    console.error('Lilop Home: error cargando productos destacados', err);
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--color-text-muted);">
        No se pudieron cargar los productos. Intenta recargar la página.
      </div>
    `;
  }
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  loadFeaturedProducts();
});