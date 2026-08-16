/* ============================================================
   Lilop — router.js
   Navegación entre páginas y manejo de parámetros URL.
   Responsabilidad única: leer y escribir la URL.

   Sin router no hay forma de saber:
   - Qué producto mostrar en producto.html (?id=sabana-queen)
   - Qué categoría filtrar en catalogo.html (?categoria=edredones)
   - Qué estado mostrar en gracias.html (?orden=12345)
   ============================================================ */

/* ─── LECTURA DE PARÁMETROS ───────────────────────────────── */

/**
 * Lee un parámetro de la URL actual.
 * @param {string} key - Nombre del parámetro
 * @returns {string|null} Valor del parámetro o null si no existe
 *
 * Ejemplo: URL = /catalogo.html?categoria=edredones&orden=precio
 * getParam('categoria') → 'edredones'
 * getParam('precio')    → null
 */
function getParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

/**
 * Lee todos los parámetros de la URL actual.
 * @returns {Object} Objeto con todos los parámetros como pares clave/valor
 */
function getAllParams() {
  const params  = new URLSearchParams(window.location.search);
  const result  = {};
  params.forEach((value, key) => { result[key] = value; });
  return result;
}

/* ─── ESCRITURA DE PARÁMETROS ─────────────────────────────── */

/**
 * Agrega o actualiza un parámetro en la URL SIN recargar la página.
 * @param {string} key   - Nombre del parámetro
 * @param {string} value - Valor del parámetro
 *
 * Ejemplo: setParam('categoria', 'sabanas')
 * URL cambia de /catalogo.html a /catalogo.html?categoria=sabanas
 */
function setParam(key, value) {
  const params = new URLSearchParams(window.location.search);
  params.set(key, value);
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({}, '', newUrl);
}

/**
 * Elimina un parámetro de la URL SIN recargar la página.
 * @param {string} key - Nombre del parámetro a eliminar
 */
function removeParam(key) {
  const params = new URLSearchParams(window.location.search);
  params.delete(key);
  const query  = params.toString();
  const newUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.pushState({}, '', newUrl);
}

/**
 * Reemplaza TODOS los parámetros de la URL con un nuevo conjunto.
 * @param {Object} paramsObj - Objeto con pares clave/valor
 *
 * Ejemplo: setAllParams({ categoria: 'edredones', orden: 'precio' })
 */
function setAllParams(paramsObj) {
  const params = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, value);
    }
  });
  const query  = params.toString();
  const newUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.pushState({}, '', newUrl);
}

/**
 * Limpia todos los parámetros de la URL.
 */
function clearParams() {
  window.history.pushState({}, '', window.location.pathname);
}

/* ─── NAVEGACIÓN ──────────────────────────────────────────── */

/**
 * Navega a otra página del sitio con parámetros opcionales.
 * @param {string} page      - Ruta de la página (ej: 'producto.html')
 * @param {Object} [params]  - Parámetros a pasar en la URL (opcional)
 *
 * Ejemplo: navigateTo('producto.html', { id: 'sabana-premium-queen' })
 * Navega a: /producto.html?id=sabana-premium-queen
 */
function navigateTo(page, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.set(key, value);
    }
  });
  const queryStr = query.toString();
  window.location.href = queryStr ? `${page}?${queryStr}` : page;
}

/**
 * Vuelve a la página anterior del historial.
 */
function goBack() {
  window.history.back();
}

/* ─── UTILIDADES ──────────────────────────────────────────── */

/**
 * Retorna la página actual como string limpio.
 * @returns {string} ej: 'catalogo.html', 'index.html'
 */
function currentPage() {
  const path = window.location.pathname;
  const parts = path.split('/');
  return parts[parts.length - 1] || 'index.html';
}

/**
 * Retorna true si estamos en la página indicada.
 * @param {string} page - Nombre del archivo (ej: 'catalogo.html')
 * @returns {boolean}
 */
function isPage(page) {
  return currentPage() === page;
}

/* ─── EXPORTAR API PÚBLICA ────────────────────────────────── */
window.LilopRouter = {
  getParam,
  getAllParams,
  setParam,
  removeParam,
  setAllParams,
  clearParams,
  navigateTo,
  goBack,
  currentPage,
  isPage,
};