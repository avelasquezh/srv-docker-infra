const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const CatalogoSimpleRepository = require('../../src/domains/maestros/CatalogoSimpleRepository');
const CategoriaRepository = require('../../src/domains/maestros/CategoriaRepository');
const { MaestroService, RegistroDuplicadoError } = require('../../src/domains/maestros/MaestroService');
const MaestroController = require('../../src/domains/maestros/MaestroController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

function poolFalso(escenario = 'ok') {
  return {
    query: async (sql, params) => {
      if (escenario === 'duplicado' && /INSERT/.test(sql)) {
        const err = new Error('duplicate key'); err.code = '23505'; throw err;
      }
      if (/SELECT id, nombre FROM/.test(sql)) return { rows: [{ id: 1, nombre: 'Test' }] };
      if (/INSERT INTO origenes_venta|INSERT INTO conceptos_costo|INSERT INTO conceptos_compra/.test(sql)) {
        return { rows: [{ id: 2, nombre: params[0] }] };
      }
      if (/SELECT \* FROM categorias/.test(sql)) return { rows: [{ id: 1, nombre: 'X', slug: 'x' }] };
      if (/INSERT INTO categorias/.test(sql)) return { rows: [{ id: 3, nombre: params[0], slug: params[1], tipo: params[2] }] };
      if (/UPDATE categorias/.test(sql)) return { rows: [{ id: params[4] }] };
      return { rows: [] };
    },
  };
}

function buildController(escenario) {
  const pool = poolFalso(escenario);
  const service = new MaestroService({
    origenes: new CatalogoSimpleRepository(pool, 'origenes_venta'),
    conceptosCosto: new CatalogoSimpleRepository(pool, 'conceptos_costo'),
    conceptosCompra: new CatalogoSimpleRepository(pool, 'conceptos_compra'),
    categorias: new CategoriaRepository(pool),
  });
  return new MaestroController(service);
}

describe('CatalogoSimpleRepository', () => {
  test('crear() usa la tabla inyectada en el INSERT', async () => {
    let capturado;
    const pool = { query: async (sql, params) => { capturado = { sql, params }; return { rows: [{ id: 1, nombre: 'X' }] }; } };
    await new CatalogoSimpleRepository(pool, 'conceptos_compra').crear('X');
    assert.match(capturado.sql, /INSERT INTO conceptos_compra/);
  });
});

describe('MaestroController — validación', () => {
  test('crearOrigen() sin nombre responde 400', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.crearOrigen({ body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('crearOrigen() con nombre solo-espacios responde 400 (trim)', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.crearOrigen({ body: { nombre: '   ' } }, res);
    assert.equal(res._status, 400);
  });

  test('crearConceptoCompra() con nombre solo-espacios NO responde 400 (bug preexistente preservado)', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.crearConceptoCompra({ body: { nombre: '   ' } }, res);
    assert.equal(res._status, 201);
  });

  test('crearOrigen() duplicado responde 400 con RegistroDuplicadoError', async () => {
    const c = buildController('duplicado');
    const res = fakeRes();
    await c.crearOrigen({ body: { nombre: 'Repetido' } }, res);
    assert.equal(res._status, 400);
    assert.equal(res._json.error, 'El origen ya existe');
  });

  test('crearCategoria() normaliza el slug (trim/lower/guiones)', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.crearCategoria({ body: { nombre: 'Ropa', slug: '  Ropa De Cama  ' } }, res);
    assert.equal(res._status, 201);
    assert.equal(res._json.slug, 'ropa-de-cama');
  });

  test('crearCategoria() con tipo inválido responde 400', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.crearCategoria({ body: { nombre: 'Ropa', slug: 'ropa', tipo: 'algo_raro' } }, res);
    assert.equal(res._status, 400);
  });

  test('crearCategoria() sin tipo cae a linea_producto por defecto', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.crearCategoria({ body: { nombre: 'Ropa', slug: 'ropa' } }, res);
    assert.equal(res._status, 201);
    assert.equal(res._json.tipo, 'linea_producto');
  });

  test('crearCategoria() sin slug responde 400', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.crearCategoria({ body: { nombre: 'Ropa' } }, res);
    assert.equal(res._status, 400);
  });

  test('actualizarCategoria() responde 404 si no existe', async () => {
    const pool = { query: async () => ({ rows: [] }) };
    const service = new MaestroService({ categorias: new CategoriaRepository(pool) });
    const c = new MaestroController(service);
    const res = fakeRes();
    await c.actualizarCategoria({ params: { id: '999' }, body: {} }, res);
    assert.equal(res._status, 404);
  });
});

describe('MaestroService — traducción de errores', () => {
  test('propaga el error tal cual si no es 23505', async () => {
    const repoFalso = { crear: async () => { throw new Error('otro error'); } };
    const service = new MaestroService({ origenes: repoFalso });
    await assert.rejects(() => service.crearOrigen('X'), (err) => {
      assert.ok(!(err instanceof RegistroDuplicadoError));
      return true;
    });
  });
});
