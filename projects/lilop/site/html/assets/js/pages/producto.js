/* ============================================================
   Lilop — pages/producto.js
   Responsabilidad única: lógica de la página de producto.
   - Lee ?id= de la URL para saber qué producto mostrar
   - Carga el producto desde products.json
   - Renderiza galería con thumbnails clicables
   - Maneja selección de variantes con validación
   - Agrega al carrito con la variante seleccionada
   - Genera link de WhatsApp con el producto
   - Renderiza acordeón de descripción/materiales/cuidados
   - Carga productos relacionados (misma categoría)
   - Inicializa scroll reveal en relacionados
   ============================================================ */

'use strict';

const store  = window.LilopStore;
const router = window.LilopRouter;

/* ─── ESTADO LOCAL ────────────────────────────────────────── */
const state = {
  product:          null,
  allProducts:      [],
  selectedVariants: {},   /* { "Tamaño": "Queen", "Color": "Blanco" } */
  currentImageIdx:  0,
};

const WHATSAPP_NUMBER = '573001234567';

/* ─── GALERÍA ─────────────────────────────────────────────── */
function renderGallery(product) {
  const mainImg  = document.getElementById('galleryMainImg');
  const thumbs   = document.getElementById('galleryThumbs');
  const badgeEl  = document.getElementById('galleryBadge');

  if (!mainImg) return;

  /* Imagen principal */
  mainImg.src = product.images[0];
  mainImg.alt = product.name;
  state.currentImageIdx = 0;

  /* Badge */
  if (badgeEl && product.badge) {
    badgeEl.innerHTML = `<span class="badge badge--${product.badgeType || 'new'}">${product.badge}</span>`;
  }

  /* Thumbnails */
  if (thumbs && product.images.length > 1) {
    thumbs.innerHTML = product.images.map((src, i) => `
      <button
        class="product-gallery__thumb ${i === 0 ? 'is-active' : ''}"
        data-img-idx="${i}"
        role="listitem"
        aria-label="Ver imagen ${i + 1} de ${product.images.length}"
        aria-pressed="${i === 0}"
      >
        <img src="${src}" alt="${product.name} — imagen ${i + 1}" loading="lazy" />
      </button>
    `).join('');

    thumbs.querySelectorAll('.product-gallery__thumb').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.imgIdx, 10);
        setMainImage(idx);
      });
    });
  } else if (thumbs) {
    thumbs.innerHTML = '';
  }
}

function setMainImage(idx) {
  const product  = state.product;
  const mainImg  = document.getElementById('galleryMainImg');
  const thumbs   = document.getElementById('galleryThumbs');
  if (!mainImg || !product.images[idx]) return;

  state.currentImageIdx = idx;
  mainImg.src = product.images[idx];

  /* Actualizar estado activo de thumbnails */
  thumbs?.querySelectorAll('.product-gallery__thumb').forEach((btn) => {
    const isActive = parseInt(btn.dataset.imgIdx, 10) === idx;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

/* ─── RENDERIZAR ESTRELLAS ────────────────────────────────── */
function renderStars(rating, size = 16) {
  const full  = Math.floor(rating);
  const empty = 5 - full;
  const s  = `<svg class="product-info__star" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  const se = `<svg class="product-info__star product-info__star--empty" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  return s.repeat(full) + se.repeat(empty);
}

/* ─── RENDERIZAR INFO PRINCIPAL ───────────────────────────── */
function renderInfo(product) {
  const cat       = document.getElementById('productCategory');
  const title     = document.getElementById('productTitle');
  const rating    = document.getElementById('productRating');
  const priceWrap = document.getElementById('productPriceWrap');
  const shortDesc = document.getElementById('productShortDesc');
  const crumb     = document.getElementById('breadcrumbProduct');

  if (cat)    cat.textContent    = product.categoryLabel;
  if (title)  title.textContent  = product.name;
  if (shortDesc) shortDesc.textContent = product.shortDescription;
  if (crumb)  crumb.textContent  = product.name;

  /* Meta tags dinámicos */
  document.title = `${product.name} — Lilop`;
  const metaDesc = document.getElementById('metaDescription');
  if (metaDesc) metaDesc.content = product.shortDescription;

  /* Rating */
  if (rating) {
    rating.innerHTML = `
      <div class="product-info__stars" aria-hidden="true">${renderStars(product.rating)}</div>
      <span class="product-info__rating-score">${product.rating}</span>
      <span class="product-info__rating-count">(${product.reviewCount} reseñas)</span>
    `;
    rating.setAttribute('aria-label', `${product.rating} de 5 estrellas, ${product.reviewCount} reseñas`);
  }

  /* Precio */
  if (priceWrap) {
    const hasSale = product.originalPrice && product.originalPrice > product.price;
    const saving  = hasSale
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

    priceWrap.innerHTML = `
      <span class="product-info__price">${store.formatPrice(product.price)}</span>
      ${hasSale ? `<span class="product-info__price-original">${store.formatPrice(product.originalPrice)}</span>` : ''}
      ${saving   ? `<span class="product-info__price-save">−${saving}%</span>` : ''}
    `;
  }

  /* WhatsApp link */
  updateWhatsAppLink();
}

/* ─── VARIANTES ───────────────────────────────────────────── */
function renderVariants(product) {
  const container = document.getElementById('productVariants');
  if (!container) return;

  const variants = product.variants || {};
  const entries  = Object.entries(variants);

  if (!entries.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = entries.map(([label, options]) => `
    <div class="variant-group" data-variant-group="${label}">
      <p class="variant-group__label">
        ${label}:
        <span class="variant-group__selected" id="variantSelected_${label}">
          — Selecciona una opción
        </span>
      </p>
      <div class="variant-group__options" role="group" aria-label="Opciones de ${label}">
        ${options.map((opt) => `
          <button
            class="variant-btn"
            data-variant-group="${label}"
            data-variant-value="${opt}"
            aria-pressed="false"
            aria-label="${label}: ${opt}"
          >
            ${opt}
          </button>
        `).join('')}
      </div>
      <p class="variant-error-msg" id="variantError_${label}" aria-live="polite">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Por favor selecciona ${label}
      </p>
    </div>
  `).join('');

  /* Eventos de los botones de variante */
  container.querySelectorAll('.variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.variantGroup;
      const value = btn.dataset.variantValue;

      /* Desmarcar todos del mismo grupo */
      container.querySelectorAll(`.variant-btn[data-variant-group="${group}"]`)
        .forEach((b) => {
          b.classList.remove('is-selected');
          b.setAttribute('aria-pressed', 'false');
        });

      /* Marcar el seleccionado */
      btn.classList.add('is-selected');
      btn.setAttribute('aria-pressed', 'true');

      /* Actualizar estado */
      state.selectedVariants[group] = value;

      /* Actualizar label */
      const selectedLabel = document.getElementById(`variantSelected_${group}`);
      if (selectedLabel) selectedLabel.textContent = value;

      /* Quitar error si estaba */
      const groupEl = container.querySelector(`.variant-group[data-variant-group="${group}"]`);
      groupEl?.classList.remove('has-error');

      /* Actualizar WhatsApp */
      updateWhatsAppLink();
    });
  });
}

/* ─── VALIDAR VARIANTES ───────────────────────────────────── */
function validateVariants() {
  const product  = state.product;
  const variants = product.variants || {};
  let   valid    = true;

  Object.keys(variants).forEach((label) => {
    if (!state.selectedVariants[label]) {
      valid = false;
      const groupEl = document.querySelector(`.variant-group[data-variant-group="${label}"]`);
      groupEl?.classList.add('has-error');
    }
  });

  return valid;
}

/* ─── WHATSAPP LINK ───────────────────────────────────────── */
function updateWhatsAppLink() {
  const btn     = document.getElementById('whatsappBtn');
  const product = state.product;
  if (!btn || !product) return;

  const variantStr = Object.entries(state.selectedVariants)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const msg = encodeURIComponent(
    `Hola, estoy interesado/a en:\n\n*${product.name}*\n` +
    (variantStr ? `Opciones: ${variantStr}\n` : '') +
    `Precio: ${store.formatPrice(product.price)}\n\n` +
    `¿Está disponible?`
  );

  btn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

/* ─── ACORDEÓN ────────────────────────────────────────────── */
function renderAccordion(product) {
  const container = document.getElementById('productAccordion');
  if (!container) return;

  const sections = [
    {
      id:    'desc',
      title: 'Descripción completa',
      open:  true,
      content: `<p>${product.description}</p>`,
    },
    {
      id:    'materials',
      title: 'Materiales y composición',
      open:  false,
      content: `<ul>${(product.materials || []).map((m) => `<li>${m}</li>`).join('')}</ul>`,
    },
    {
      id:    'care',
      title: 'Instrucciones de cuidado',
      open:  false,
      content: `<ul>${(product.care || []).map((c) => `<li>${c}</li>`).join('')}</ul>`,
    },
    {
      id:    'shipping',
      title: 'Envío y entrega',
      open:  false,
      content: `
        <ul>
          <li>Producto bajo pedido: tiempo de preparación 2-5 días hábiles</li>
          <li>Envío a todo Colombia por transportadora</li>
          <li>Envío gratis en pedidos mayores a $200.000</li>
          <li>Tiempo de entrega estimado: 3-7 días hábiles según ciudad</li>
        </ul>
      `,
    },
  ];

  container.innerHTML = sections.map((s) => `
    <div class="accordion-item" role="listitem">
      <button
        class="accordion-item__toggle"
        aria-expanded="${s.open}"
        aria-controls="accordion_${s.id}"
        id="accordionBtn_${s.id}"
      >
        ${s.title}
        <svg class="accordion-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div
        class="accordion-item__body ${s.open ? '' : 'is-hidden'}"
        id="accordion_${s.id}"
        role="region"
        aria-labelledby="accordionBtn_${s.id}"
      >
        ${s.content}
      </div>
    </div>
  `).join('');

  /* Eventos del acordeón */
  container.querySelectorAll('.accordion-item__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      const body     = document.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded', String(!expanded));
      body?.classList.toggle('is-hidden', expanded);
    });
  });
}

/* ─── PRODUCTOS RELACIONADOS ──────────────────────────────── */
function renderRelated(product, allProducts) {
  const section = document.getElementById('relatedSection');
  const grid    = document.getElementById('relatedGrid');
  if (!section || !grid) return;

  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  if (!related.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  grid.innerHTML = related.map((p, i) => {
    const hasSale = p.originalPrice && p.originalPrice > p.price;
    return `
      <article
        class="product-card reveal"
        data-delay="${i * 80}"
        data-product-id="${p.id}"
        role="listitem"
        tabindex="0"
        aria-label="${p.name}, ${store.formatPrice(p.price)}"
      >
        <div class="product-card__img-wrap">
          <img class="product-card__img" src="${p.images[0]}" alt="${p.name}" loading="lazy" />
          ${p.badge ? `<div class="product-card__badge"><span class="badge badge--${p.badgeType || 'new'}">${p.badge}</span></div>` : ''}
          <button class="product-card__quick-add" data-product-id="${p.id}" aria-label="Agregar ${p.name} al carrito">+ Agregar</button>
        </div>
        <div class="product-card__info">
          <p class="product-card__category">${p.categoryLabel}</p>
          <h3 class="product-card__name">${p.name}</h3>
          <div class="product-card__footer">
            <div class="product-card__price">
              <span class="product-card__price-current">${store.formatPrice(p.price)}</span>
              ${hasSale ? `<span class="product-card__price-original">${store.formatPrice(p.originalPrice)}</span>` : ''}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  /* Eventos en relacionados */
  grid.querySelectorAll('.product-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.product-card__quick-add')) return;
      router.navigateTo('producto.html', { id: card.dataset.productId });
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        router.navigateTo('producto.html', { id: card.dataset.productId });
      }
    });
  });

  grid.querySelectorAll('.product-card__quick-add').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = related.find((x) => x.id === btn.dataset.productId);
      if (!p) return;
      const hasVariants = p.variants && Object.keys(p.variants).length > 0;
      if (hasVariants) {
        router.navigateTo('producto.html', { id: p.id });
        return;
      }
      store.addToCart({ id: p.id, name: p.name, price: p.price, image: p.images[0], variant: '' });
      window.dispatchEvent(new CustomEvent('lilop:cart:open'));
    });
  });

  /* Scroll reveal en relacionados */
  const revealEls = grid.querySelectorAll('.reveal');
  const observer  = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const delay = entry.target.dataset.delay || 0;
      setTimeout(() => entry.target.classList.add('is-visible'), parseInt(delay, 10));
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  revealEls.forEach((el) => observer.observe(el));
}

/* ─── BOTÓN AGREGAR AL CARRITO ────────────────────────────── */
function initAddToCart() {
  const btn = document.getElementById('addToCartBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const product = state.product;
    if (!product) return;

    /* Validar que todas las variantes estén seleccionadas */
    if (!validateVariants()) {
      window.LilopToast?.warning(
        'Selecciona las opciones',
        'Elige tamaño, color y demás opciones antes de agregar'
      );
      /* Scroll al primer error */
      const firstError = document.querySelector('.variant-group.has-error');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    /* Construir string de variante */
    const variantStr = Object.entries(state.selectedVariants)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' / ');

    /* Agregar al store */
    store.addToCart({
      id:      product.id,
      name:    product.name,
      price:   product.price,
      image:   product.images[0],
      variant: variantStr,
    });

    /* Abrir el carrito */
    window.dispatchEvent(new CustomEvent('lilop:cart:open'));
  });
}

/* ─── ERROR: PRODUCTO NO ENCONTRADO ──────────────────────── */
function renderNotFound() {
  const container = document.getElementById('productContainer');
  const skeleton  = document.getElementById('productSkeleton');
  if (skeleton) skeleton.style.display = 'none';
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center;padding:80px 24px;display:flex;flex-direction:column;align-items:center;gap:20px;">
      <div style="width:80px;height:80px;border-radius:50%;background:var(--color-soft);display:flex;align-items:center;justify-content:center;">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-lavender)" stroke-width="1.5">
          <circle cx="11" cy="11" r="7"/>
          <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
        </svg>
      </div>
      <h1 style="font-family:var(--font-display);font-size:var(--text-2xl);color:var(--color-text);">
        Producto no encontrado
      </h1>
      <p style="font-size:var(--text-base);color:var(--color-text-muted);">
        El producto que buscas no existe o fue removido.
      </p>
      <a href="/catalogo.html" class="btn btn--primary">Ver catálogo</a>
    </div>
  `;
}

/* ─── MOSTRAR PRODUCTO ────────────────────────────────────── */
function showProduct() {
  const skeleton = document.getElementById('productSkeleton');
  const layout   = document.getElementById('productLayout');
  if (skeleton) skeleton.style.display = 'none';
  if (layout)   layout.style.display   = 'grid';
}

/* ─── CARGAR PRODUCTO ─────────────────────────────────────── */
async function loadProduct() {
  const productId = router.getParam('id');

  if (!productId) {
    renderNotFound();
    return;
  }

  try {
    const res = await fetch('/data/products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.allProducts = await res.json();

    const product = state.allProducts.find((p) => p.id === productId);

    if (!product) {
      renderNotFound();
      return;
    }

    state.product = product;

    /* Renderizar todo */
    renderGallery(product);
    renderInfo(product);
    renderVariants(product);
    renderAccordion(product);
    renderRelated(product, state.allProducts);
    initAddToCart();
    showProduct();

  } catch (err) {
    console.error('Lilop Producto: error cargando producto', err);
    renderNotFound();
  }
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', loadProduct);