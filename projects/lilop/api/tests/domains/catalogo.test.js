const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const CatalogoRepository = require('../../src/domains/catalogo/CatalogoRepository');
const CatalogoService = require('../../src/domains/catalogo/CatalogoService');
const CatalogoController = require('../../src/domains/catalogo/CatalogoController');

function fakeRes() {
  return { _status: 200, _json: null, _headers: {}, set(k, v) { this._headers[k] = v; return this; }, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

function fakePool(responses = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ').trim();
      calls.push({ sql: s, params });
      for (const [match, fn] of Object.entries(responses)) {
        if (s.includes(match)) return fn(params);
      }
      return { rows: [] };
    },
  };
}

function build(responses) {
  const pool = fakePool(responses);
  const controller = new CatalogoController(
    new CatalogoService({ catalogo: new CatalogoRepository(pool) })
  );
  return { pool, controller };
}

describe('CatalogoController — CRUD admin', () => {
  test('crear() sin nombre responde 400 sin tocar la BD', async () => {
    const { controller, pool } = build({});
    const res = fakeRes();
    await controller.crear({ body: {} }, res);
    assert.equal(res._status, 400);
    assert.equal(pool.calls.length, 0);
  });

  test('crear() válido responde 201 con el producto insertado', async () => {
    const { controller } = build({
      'INSERT INTO catalogo_productos': (p) => ({ rows: [{ id: 'CP0099', nombre: p[0] }] }),
    });
    const res = fakeRes();
    await controller.crear({ body: { nombre: 'Ramo Rosas' } }, res);
    assert.equal(res._status, 201);
    assert.equal(res._json.id, 'CP0099');
  });

  test('actualizar() con id inexistente responde 404', async () => {
    const { controller } = build({ 'UPDATE catalogo_productos SET': () => ({ rows: [] }) });
    const res = fakeRes();
    await controller.actualizar({ params: { id: 'CPxxxx' }, body: { nombre: 'X' } }, res);
    assert.equal(res._status, 404);
  });

  test('actualizar() válido sincroniza categoria_ids y diseno_ids cuando vienen como array', async () => {
    const { controller, pool } = build({
      'UPDATE catalogo_productos SET': () => ({ rows: [{ id: 'CP0001', nombre: 'X' }] }),
    });
    const res = fakeRes();
    await controller.actualizar(
      { params: { id: 'CP0001' }, body: { nombre: 'X', categoria_ids: ['CAT1', 'CAT2'], diseno_ids: ['D1'] } },
      res
    );
    assert.equal(res._status, 200);
    const sqls = pool.calls.map((c) => c.sql);
    assert.ok(sqls.some((s) => s.includes('DELETE FROM catalogo_productos_categorias')));
    assert.ok(sqls.some((s) => s.includes('INSERT INTO catalogo_productos_categorias')));
    assert.ok(sqls.some((s) => s.includes('DELETE FROM disenos_catalogo_productos')));
    assert.ok(sqls.some((s) => s.includes('INSERT INTO disenos_catalogo_productos')));
  });

  test('actualizar() sin categoria_ids/diseno_ids no toca esas tablas relacionadas', async () => {
    const { controller, pool } = build({
      'UPDATE catalogo_productos SET': () => ({ rows: [{ id: 'CP0001' }] }),
    });
    const res = fakeRes();
    await controller.actualizar({ params: { id: 'CP0001' }, body: { nombre: 'X' } }, res);
    assert.equal(pool.calls.length, 1);
  });

  test('eliminar() con id inexistente responde 404', async () => {
    const { controller } = build({ 'DELETE FROM catalogo_productos WHERE id': () => ({ rows: [] }) });
    const res = fakeRes();
    await controller.eliminar({ params: { id: 'CPxxxx' } }, res);
    assert.equal(res._status, 404);
  });

  test('eliminar() exitoso responde {ok:true}', async () => {
    const { controller } = build({ 'DELETE FROM catalogo_productos WHERE id': () => ({ rows: [{ id: 'CP0001' }] }) });
    const res = fakeRes();
    await controller.eliminar({ params: { id: 'CP0001' } }, res);
    assert.equal(res._status, 200);
    assert.deepEqual(res._json, { ok: true });
  });
});

describe('CatalogoController — precios', () => {
  test('upsertPrecio() sin tamanio/precio responde 400', async () => {
    const { controller, pool } = build({});
    const res = fakeRes();
    await controller.upsertPrecio({ params: { catalogo_id: 'CP0001' }, body: {} }, res);
    assert.equal(res._status, 400);
    assert.equal(pool.calls.length, 0);
  });

  test('upsertPrecio() con precio <= 0 elimina la variante base de ese tamaño (Fase 5: ya no toca catalogo_precios)', async () => {
    const { controller, pool } = build({
      "SELECT id FROM variables WHERE nombre = 'Tamaño'": () => ({ rows: [{ id: 'VAR0001' }] }),
      'SELECT id FROM variable_valores': () => ({ rows: [{ id: 'VVA0002' }] }),
      'DELETE FROM variantes': () => ({ rows: [] }),
    });
    const res = fakeRes();
    await controller.upsertPrecio({ params: { catalogo_id: 'CP0001' }, body: { tamanio: 'M', precio: 0 } }, res);
    assert.deepEqual(res._json, { ok: true, eliminado: true });
    const deleteCall = pool.calls.find((c) => c.sql.includes('DELETE FROM variantes'));
    assert.ok(deleteCall);
    assert.ok(!pool.calls.some((c) => c.sql.includes('catalogo_precios')));
  });

  test('upsertPrecio() válido hace INSERT ... ON CONFLICT DO UPDATE contra variantes (Fase 5)', async () => {
    const { controller, pool } = build({
      "SELECT id FROM variables WHERE nombre = 'Tamaño'": () => ({ rows: [{ id: 'VAR0001' }] }),
      'SELECT id FROM variable_valores': () => ({ rows: [{ id: 'VVA0002' }] }),
      'SELECT valores_permitidos FROM producto_variables': () => ({ rows: [{ valores_permitidos: ['VVA0002'] }] }),
      'INSERT INTO variantes': () => ({ rows: [{ id: 'VTE0001', producto_id: 'CP0001', atributos_resueltos: { Tamaño: 'M' }, precio: 25000 }] }),
    });
    const res = fakeRes();
    await controller.upsertPrecio({ params: { catalogo_id: 'CP0001' }, body: { tamanio: 'M', precio: 25000 } }, res);
    assert.equal(res._json.precio, 25000);
    const insertCall = pool.calls.find((c) => c.sql.includes('INSERT INTO variantes'));
    assert.match(insertCall.sql, /ON CONFLICT/);
    assert.ok(!pool.calls.some((c) => c.sql.includes('catalogo_precios')));
  });
});

describe('CatalogoController — listado público', () => {
  test('listarPublico() transforma filas crudas al shape del sitio (slug, price mínimo, images con dominio)', async () => {
    const { controller } = build({
      'FROM catalogo_productos c': () => ({
        rows: [{
          id: 'CP0001', nombre: 'Ramo Girasoles', activo: true,
          descripcion: null, descripcion_corta: null, materiales: null, cuidados: null, tags: null,
          featured: true, badge: null, badge_tipo: null, precio_original: '50000',
          precios: [{ tamanio: 'S', precio: '30000' }, { tamanio: 'M', precio: '45000' }],
          disenos: [{ id: 'D1', nombre: 'Clásico', imagen: '/img/d1.jpg' }],
          categorias: [{ id: 'CAT1', nombre: 'Girasoles', slug: 'girasoles' }],
          atributos: [{ id: 'A1', nombre: 'Color', tipo: 'select', sobreprecio: '0' }],
        }],
      }),
    });
    const res = fakeRes();
    await controller.listarPublico({}, res);
    const p = res._json[0];
    assert.equal(p.slug, 'ramo-girasoles');
    assert.equal(p.price, 30000);
    assert.equal(p.originalPrice, 50000);
    assert.equal(p.category, 'girasoles');
    assert.deepEqual(p.images, ['https://api.lilop.store/img/d1.jpg']);
    assert.equal(res._headers['Cache-Control'], 'public, max-age=60');
  });

  test('listarPublico() con producto sin precios da price:0 en vez de romper con Math.min([])', async () => {
    const { controller } = build({
      'FROM catalogo_productos c': () => ({
        rows: [{ id: 'CP0002', nombre: 'Sin Precios', precios: null, disenos: null, categorias: null, atributos: null, precio_original: null }],
      }),
    });
    const res = fakeRes();
    await controller.listarPublico({}, res);
    assert.equal(res._json[0].price, 0);
  });
});

describe('CatalogoController — manejo de errores', () => {
  test('error de BD responde 500 genérico vía BaseController.handle', async () => {
    const pool = { query: async () => { throw new Error('conexión perdida'); } };
    const controller = new CatalogoController(new CatalogoService({ catalogo: new CatalogoRepository(pool) }));
    const res = fakeRes();
    await controller.listar({}, res);
    assert.equal(res._status, 500);
    assert.deepEqual(res._json, { error: 'Error interno del servidor' });
  });
});
