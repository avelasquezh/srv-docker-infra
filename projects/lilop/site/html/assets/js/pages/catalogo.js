/* ============================================================
   Lilop — pages/catalogo.js
   Responsabilidad única: lógica del catálogo.
   - Carga todos los productos desde products.json
   - Lee parámetros de URL para filtro y búsqueda inicial
   - Aplica filtros por categoría, precio y disponibilidad
   - Búsqueda en tiempo real por nombre, descripción y tags
   - Ordena resultados por relevancia, precio y valoración
   - Sincroniza filtros activos con URL (para compartir)
   - Maneja drawer de filtros en móvil
   - Renderiza tarjetas y navega a producto.html
   ============================================================ */

'use strict';

const store  = window.LilopStore;
const router = window.LilopRouter;

/* ─── ESTADO LOCAL ────────────────────────────────────────── */
const state = {
  allProducts:  [],
  filtered:     [],
  filters: {
    categories: [],   /* array de strings */
    priceMin:   null,
    priceMax:   null,
    onlyFeatured: false,
  },
  search:  '',
  sortBy:  'relevance',
};

/* ─── LABELS DE CATEGORÍA ─────────────────────────────────── */
let CATEGORY_LABELS = {};

async function loadCategorias() {
  try {
    const res  = await fetch('https://api.lilop.store/api/public/categorias');
    const cats = await res.json();
    cats.forEach(c => { CATEGORY_LABELS[c.slug] = c.nombre; });

    const container = document.getElementById('filterCategory');
    if (container) {
      container.innerHTML = cats.map(c => `
        <label class="filter-option">
          <input type="checkbox" name="category" value="${c.slug}" />
          <span>${c.nombre}</span>
          <span class="filter-option__count" data-cat="${c.slug}"></span>
        </label>`).join('');
    }
  } catch {}
}

const CATEGORY_LABELS_LEGACY = {
  sabanas:     'Sábanas',
  edredones:   'Edredones',
  almohadas:   'Almohadas',
  cubrecamas:  'Cubrecamas',
  fundas:      'Fundas',
  toallas:     'Toallas',
  protectores: 'Protectores',
  decoracion:  'Decoración',
};

/* ─── RANGO DE PRECIO (según tamaños disponibles) ─────────── */
function getPriceRange(product) {
  const precios = (product.precios || []).map(p => p.precio).filter(p => typeof p === 'number');
  if (!precios.length) return { min: product.price, max: product.price };
  return { min: Math.min(...precios), max: Math.max(...precios) };
}

/* ─── TEMPLATE DE TARJETA ─────────────────────────────────── */
function renderCard(product, index) {
  const { min: priceMin, max: priceMax } = getPriceRange(product);
  const hasRange   = priceMax > priceMin;
  const hasSale    = !hasRange && product.originalPrice && product.originalPrice > product.price;

  const priceHTML  = hasRange
    ? `<span class="product-card__price-current">${store.formatPrice(priceMin)} - ${store.formatPrice(priceMax)}</span>`
    : hasSale
      ? `<span class="product-card__price-current">${store.formatPrice(product.price)}</span>
         <span class="product-card__price-original">${store.formatPrice(product.originalPrice)}</span>`
      : `<span class="product-card__price-current">${store.formatPrice(product.price)}</span>`;

  const badgeHTML = product.badge
    ? `<div class="product-card__badge">
         <span class="badge badge--${product.badgeType || 'new'}">${product.badge}</span>
       </div>`
    : '';

  return `
    <article
      class="product-card"
      data-product-id="${product.id}"
      role="listitem"
      tabindex="0"
      aria-label="${product.name}, ${store.formatPrice(product.price)}"
      style="animation-delay:${index * 50}ms"
    >
      <div class="product-card__img-wrap">
        <img
          class="product-card__img"
          src="${product.images[0] || ''}"
          alt="${product.name}"
          loading="lazy"
          onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 400 400%27%3E%3Crect width=%27400%27 height=%27400%27 fill=%27%23f3f0f8%27/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23a89bc4%22 font-family=%22sans-serif%22 font-size=%2220%22%3ESin imagen%3C/text%3E%3C/svg%3E'"
        />
        ${badgeHTML}
        <button
          class="product-card__quick-add"
          data-product-id="${product.id}"
          aria-label="Agregar ${product.name} al carrito"
        >
          + Agregar al carrito
        </button>
      </div>
      <div class="product-card__info">
        <p class="product-card__category">${product.categoryLabel}</p>
        <h3 class="product-card__name">${product.name}</h3>
        <p class="product-card__short-desc">${product.shortDescription}</p>
        <div class="product-card__footer">
          <div class="product-card__price">${priceHTML}</div>
        </div>
      </div>
    </article>
  `;
}

/* ─── APLICAR FILTROS Y BÚSQUEDA ──────────────────────────── */
function applyFilters() {
  let results = [...state.allProducts];

  /* Búsqueda por texto */
  const q = state.search.trim().toLowerCase();
  if (q) {
    results = results.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.shortDescription.toLowerCase().includes(q) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }

  /* Filtro por categoría */
  if (state.filters.categories.length > 0) {
    results = results.filter((p) =>
      (p.categorias || []).some(c => state.filters.categories.includes(c.slug))
    );
  }

  /* Filtro por precio */
  if (state.filters.priceMin !== null) {
    results = results.filter((p) => p.price >= state.filters.priceMin);
  }
  if (state.filters.priceMax !== null) {
    results = results.filter((p) => p.price <= state.filters.priceMax);
  }

  /* Filtro solo destacados */
  if (state.filters.onlyFeatured) {
    results = results.filter((p) => p.featured);
  }

  /* Ordenamiento */
  switch (state.sortBy) {
    case 'price-asc':
      results.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      results.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      results.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      break;
    case 'newest':
      /* En JSON estático usamos el orden inverso como proxy de "más nuevo" */
      results.reverse();
      break;
    default:
      /* relevance: destacados primero */
      results.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  state.filtered = results;
}

/* ─── RENDERIZAR GRILLA ───────────────────────────────────── */
function renderGrid() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  applyFilters();

  /* Actualizar contador */
  updateCount();
  updateActiveFilterChips();
  syncURL();

  if (state.filtered.length === 0) {
    grid.innerHTML = `
      <div class="catalog-empty" role="status" aria-live="polite">
        <div class="catalog-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7"/>
            <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="catalog-empty__title">Sin resultados</p>
        <p class="catalog-empty__desc">
          No encontramos productos con esos filtros.<br/>
          Intenta con otros términos o limpia los filtros.
        </p>
        <button class="btn btn--outline" id="emptyReset">Limpiar filtros</button>
      </div>
    `;
    document.getElementById('emptyReset')
      ?.addEventListener('click', resetFilters);
    return;
  }

  grid.innerHTML = state.filtered
    .map((p, i) => renderCard(p, i))
    .join('');

  /* Eventos de cada tarjeta */
  grid.querySelectorAll('.product-card').forEach((card) => {
    const goToProduct = (e) => {
      if (e.target.closest('.product-card__quick-add')) return;
      router.navigateTo('producto.html', { id: card.dataset.productId });
    };
    card.addEventListener('click', goToProduct);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToProduct(e); }
    });
  });

  /* Botones de agregar rápido */
  grid.querySelectorAll('.product-card__quick-add').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const product = state.allProducts.find((p) => p.id === btn.dataset.productId);
      if (!product) return;

      const hasVariants = product.variants && Object.keys(product.variants).length > 0;
      if (hasVariants) {
        router.navigateTo('producto.html', { id: product.id });
        return;
      }

      store.addToCart({
        id:      product.id,
        name:    product.name,
        price:   product.price,
        image:   product.images[0],
        variant: '',
      });
      window.dispatchEvent(new CustomEvent('lilop:cart:open'));
    });
  });
}

/* ─── ACTUALIZAR CONTADOR Y TÍTULO ───────────────────────── */
function updateCount() {
  const countEl = document.getElementById('catalogCount');
  const titleEl = document.getElementById('catalogTitle');
  const crumbEl = document.getElementById('breadcrumbCurrent');
  if (!countEl) return;

  const n       = state.filtered.length;
  const total   = state.allProducts.length;

  countEl.innerHTML = n === total
    ? `<strong>${n}</strong> producto${n !== 1 ? 's' : ''}`
    : `<strong>${n}</strong> de ${total} producto${total !== 1 ? 's' : ''}`;

  /* Actualizar título según categoría activa */
  if (state.filters.categories.length === 1) {
    const label = CATEGORY_LABELS[state.filters.categories[0]] || 'Productos';
    if (titleEl) titleEl.textContent = label;
    if (crumbEl) crumbEl.textContent = label;
  } else {
    if (titleEl) titleEl.textContent = 'Todos los productos';
    if (crumbEl) crumbEl.textContent = 'Catálogo';
  }
}

/* ─── CHIPS DE FILTROS ACTIVOS ────────────────────────────── */
function updateActiveFilterChips() {
  const container = document.getElementById('activeFilters');
  const countBadge = document.getElementById('activeFiltersCount');
  if (!container) return;

  const chips = [];

  /* Chips por categoría */
  state.filters.categories.forEach((cat) => {
    chips.push({
      label: CATEGORY_LABELS[cat] || cat,
      onRemove: () => {
        state.filters.categories = state.filters.categories.filter((c) => c !== cat);
        syncCheckboxes();
        renderGrid();
      },
    });
  });

  /* Chip de precio */
  if (state.filters.priceMin !== null || state.filters.priceMax !== null) {
    const min = state.filters.priceMin ? store.formatPrice(state.filters.priceMin) : '0';
    const max = state.filters.priceMax ? store.formatPrice(state.filters.priceMax) : '∞';
    chips.push({
      label: `${min} – ${max}`,
      onRemove: () => {
        state.filters.priceMin = null;
        state.filters.priceMax = null;
        document.getElementById('priceMin').value = '';
        document.getElementById('priceMax').value = '';
        renderGrid();
      },
    });
  }

  /* Chip solo destacados */
  if (state.filters.onlyFeatured) {
    chips.push({
      label: 'Solo destacados',
      onRemove: () => {
        state.filters.onlyFeatured = false;
        const cb = document.querySelector('input[name="stock"][value="featured"]');
        if (cb) cb.checked = false;
        renderGrid();
      },
    });
  }

  /* Chip de búsqueda */
  if (state.search.trim()) {
    chips.push({
      label: `"${state.search.trim()}"`,
      onRemove: () => {
        state.search = '';
        const input = document.getElementById('catalogSearch');
        const clear = document.getElementById('searchClear');
        if (input) input.value = '';
        if (clear) clear.classList.remove('is-visible');
        renderGrid();
      },
    });
  }

  /* Render chips */
  container.innerHTML = chips.map((_, i) => `
    <button
      class="active-filter-chip"
      data-chip-index="${i}"
      role="listitem"
      aria-label="Quitar filtro: ${chips[i].label}"
    >
      ${chips[i].label}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `).join('');

  container.querySelectorAll('.active-filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      chips[parseInt(chip.dataset.chipIndex)]?.onRemove();
    });
  });

  /* Badge de cantidad de filtros activos (móvil) */
  if (countBadge) {
    const count = chips.length;
    countBadge.textContent = count;
    countBadge.classList.toggle('is-visible', count > 0);
  }
}

/* ─── SINCRONIZAR CHECKBOXES CON ESTADO ───────────────────── */
function syncCheckboxes() {
  document.querySelectorAll('input[name="category"]').forEach((cb) => {
    cb.checked = state.filters.categories.includes(cb.value);
  });
}

/* ─── SINCRONIZAR URL ─────────────────────────────────────── */
function syncURL() {
  const params = {};
  if (state.filters.categories.length === 1) params.categoria = state.filters.categories[0];
  if (state.search.trim()) params.buscar = state.search.trim();
  if (state.sortBy !== 'relevance') params.orden = state.sortBy;
  router.setAllParams(params);
}

/* ─── LEER URL AL INICIAR ─────────────────────────────────── */
function readURLParams() {
  const categoria = router.getParam('categoria');
  const buscar    = router.getParam('buscar');
  const orden     = router.getParam('orden');

  if (categoria && CATEGORY_LABELS[categoria]) {
    state.filters.categories = [categoria];
    const cb = document.querySelector(`input[name="category"][value="${categoria}"]`);
    if (cb) cb.checked = true;
  }

  if (buscar) {
    state.search = buscar;
    const input = document.getElementById('catalogSearch');
    const clear = document.getElementById('searchClear');
    if (input) input.value = buscar;
    if (clear) clear.classList.add('is-visible');
  }

  if (orden) {
    state.sortBy = orden;
    const select = document.getElementById('catalogSortSelect');
    if (select) select.value = orden;
  }
}

/* ─── RESET DE FILTROS ────────────────────────────────────── */
function resetFilters() {
  state.filters.categories  = [];
  state.filters.priceMin    = null;
  state.filters.priceMax    = null;
  state.filters.onlyFeatured = false;
  state.search               = '';
  state.sortBy               = 'relevance';

  /* Limpiar UI */
  document.querySelectorAll('input[name="category"]').forEach((cb) => cb.checked = false);
  document.querySelectorAll('input[name="stock"]').forEach((cb) => {
    cb.checked = cb.value === 'available';
  });
  const priceMin = document.getElementById('priceMin');
  const priceMax = document.getElementById('priceMax');
  const search   = document.getElementById('catalogSearch');
  const clear    = document.getElementById('searchClear');
  const sort     = document.getElementById('catalogSortSelect');
  if (priceMin) priceMin.value = '';
  if (priceMax) priceMax.value = '';
  if (search)   search.value  = '';
  if (clear)    clear.classList.remove('is-visible');
  if (sort)     sort.value    = 'relevance';

  renderGrid();
}

/* ─── INIT FILTROS ACCORDION ──────────────────────────────── */
function initFilterAccordions() {
  document.querySelectorAll('.filter-group__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      const body     = document.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded', String(!expanded));
      if (body) body.classList.toggle('is-collapsed', expanded);
    });
  });
}

/* ─── INIT DRAWER MÓVIL ───────────────────────────────────── */
function initFiltersDrawer() {
  const toggle   = document.getElementById('filterToggle');
  const drawer   = document.getElementById('filtersDrawer');
  const close    = document.getElementById('filtersDrawerClose');
  const apply    = document.getElementById('filtersDrawerApply');
  const overlay  = document.getElementById('mainOverlay');

  const openDrawer = () => {
    drawer?.classList.add('is-open');
    drawer?.setAttribute('aria-hidden', 'false');
    toggle?.setAttribute('aria-expanded', 'true');
    overlay?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    drawer?.classList.remove('is-open');
    drawer?.setAttribute('aria-hidden', 'true');
    toggle?.setAttribute('aria-expanded', 'false');
    overlay?.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  toggle?.addEventListener('click', openDrawer);
  close?.addEventListener('click', closeDrawer);
  apply?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);
}

/* ─── INIT EVENTOS DE FILTROS ─────────────────────────────── */
function initFilterEvents() {
  /* Categorías */
  document.querySelectorAll('input[name="category"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!state.filters.categories.includes(cb.value)) {
          state.filters.categories.push(cb.value);
        }
      } else {
        state.filters.categories = state.filters.categories.filter((c) => c !== cb.value);
      }
      renderGrid();
    });
  });

  /* Disponibilidad */
  document.querySelectorAll('input[name="stock"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.value === 'featured') {
        state.filters.onlyFeatured = cb.checked;
        renderGrid();
      }
    });
  });

  /* Precio */
  document.getElementById('priceApply')?.addEventListener('click', () => {
    const minVal = parseFloat(document.getElementById('priceMin')?.value);
    const maxVal = parseFloat(document.getElementById('priceMax')?.value);
    state.filters.priceMin = isNaN(minVal) ? null : minVal;
    state.filters.priceMax = isNaN(maxVal) ? null : maxVal;
    renderGrid();
  });

  /* Reset */
  document.getElementById('filtersReset')?.addEventListener('click', resetFilters);

  /* Búsqueda con debounce */
  let searchTimer;
  const searchInput = document.getElementById('catalogSearch');
  const searchClear = document.getElementById('searchClear');

  searchInput?.addEventListener('input', (e) => {
    state.search = e.target.value;
    searchClear?.classList.toggle('is-visible', state.search.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderGrid, 300);
  });

  searchClear?.addEventListener('click', () => {
    state.search = '';
    if (searchInput) searchInput.value = '';
    searchClear.classList.remove('is-visible');
    renderGrid();
    searchInput?.focus();
  });

  /* Ordenamiento */
  document.getElementById('catalogSortSelect')?.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderGrid();
  });
}

/* ─── ACTUALIZAR CONTADORES EN FILTROS ────────────────────── */
function updateFilterCounts() {
  Object.keys(CATEGORY_LABELS).forEach((cat) => {
    const count = state.allProducts.filter((p) => (p.categorias || []).some(c => c.slug === cat)).length;
    const el    = document.querySelector(`.filter-option__count[data-cat="${cat}"]`);
    if (el) el.textContent = count > 0 ? `(${count})` : '';
  });
}

/* ─── CARGAR PRODUCTOS ────────────────────────────────────── */
async function loadProducts() {
  try {
    const res = await fetch('https://api.lilop.store/api/public/productos');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.allProducts = await res.json();
    updateFilterCounts();
    readURLParams();
    renderGrid();
  } catch (err) {
    console.error('Lilop Catálogo: error cargando productos', err);
    const grid = document.getElementById('catalogGrid');
    if (grid) {
      grid.innerHTML = `
        <div class="catalog-empty" role="alert">
          <div class="catalog-empty__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="catalog-empty__title">Error al cargar</p>
          <p class="catalog-empty__desc">No se pudieron cargar los productos. Recarga la página.</p>
          <button class="btn btn--primary" onclick="window.location.reload()">Recargar</button>
        </div>
      `;
    }
  }
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadCategorias();
  initFilterAccordions();
  initFiltersDrawer();
  initFilterEvents();
  loadProducts();
});