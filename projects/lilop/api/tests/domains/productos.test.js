const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ProductoRepository = require('../../src/domains/productos/ProductoRepository');
const ProductoService = require('../../src/domains/productos/ProductoService');
const ProductoController = require('../../src/domains/productos/ProductoController');

// Misma fila de ejemplo real (CAT0032) usada para la validación manual
// documentada en el MD (sección 7ter) — congelada aquí como test de
// regresión permanente, para que cualquier cambio futuro al dominio la
// rompa visiblemente en vez de descubrirse en producción.
const FILA_REAL_CAT0032 = {
  id: 'CAT0032', nombre: 'Edredón acolchado en Microfibra Unicolor', descripcion_corta: null,
  variables: [{ nombre: 'Tamaño', tipo: 'lista', valores: ['Sencillo', 'Semidoble', 'Doble', 'Queen', 'King'] }],
  variantes: [
    { id: 'VTE0139', atributos: { Tamaño: 'Sencillo' }, precio: '125000.00' },
    { id: 'VTE0141', atributos: { Tamaño: 'Sencillo', 'Plumón (extragrueso)': true }, precio: '145000.00' },
  ],
};

function fakeRes() {
  return {
    _status: 200, _json: null, _headers: {},
    status(c) { this._status = c; return this; },
    json(o) { this._json = o; return this; },
    set(k, v) { this._headers[k] = v; return this; },
  };
}

describe('ProductoRepository', () => {
  test('obtenerConVariantes() consulta con el WHERE y parámetro correctos', async () => {
    let capturado = null;
    const poolEspia = { query: async (sql, params) => { capturado = { sql, params }; return { rows: [] }; } };
    const repo = new ProductoRepository(poolEspia);
    await repo.obtenerConVariantes('CAT0032');
    assert.deepEqual(capturado.params, ['CAT0032']);
    assert.match(capturado.sql, /WHERE c\.activo = true AND c\.id = \$1/);
  });

  test('obtenerConVariantes() devuelve null si no hay filas', async () => {
    const poolVacio = { query: async () => ({ rows: [] }) };
    const repo = new ProductoRepository(poolVacio);
    const resultado = await repo.obtenerConVariantes('CAT9999');
    assert.equal(resultado, null);
  });
});

describe('ProductoService', () => {
  test('_formatear() produce el contrato exacto documentado en 7bis', () => {
    const service = new ProductoService({});
    const salida = service._formatear(FILA_REAL_CAT0032);
    assert.deepEqual(salida, {
      id: 'CAT0032',
      nombre: 'Edredón acolchado en Microfibra Unicolor',
      descripcion: null,
      variables: [{ nombre: 'Tamaño', tipo: 'lista', valores: ['Sencillo', 'Semidoble', 'Doble', 'Queen', 'King'] }],
      variantes: [
        { id: 'VTE0139', atributos: { Tamaño: 'Sencillo' }, precio: 125000 },
        { id: 'VTE0141', atributos: { Tamaño: 'Sencillo', 'Plumón (extragrueso)': true }, precio: 145000 },
      ],
    });
  });

  test('precio siempre sale como number, nunca como string', () => {
    const service = new ProductoService({});
    const salida = service._formatear(FILA_REAL_CAT0032);
    for (const v of salida.variantes) assert.equal(typeof v.precio, 'number');
  });

  test('listarParaBot() formatea todas las filas del repositorio', async () => {
    const repoFalso = { listarConVariantes: async () => [FILA_REAL_CAT0032] };
    const service = new ProductoService({ productos: repoFalso });
    const resultado = await service.listarParaBot();
    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].id, 'CAT0032');
  });
});

describe('ProductoController', () => {
  test('listar() responde 200 con Cache-Control y el precio correcto', async () => {
    const repoFalso = { listarConVariantes: async () => [FILA_REAL_CAT0032] };
    const controller = new ProductoController(new ProductoService({ productos: repoFalso }));
    const res = fakeRes();
    await controller.listar({}, res);
    assert.equal(res._status, 200);
    assert.equal(res._headers['Cache-Control'], 'public, max-age=60');
    assert.equal(res._json[0].variantes[1].precio, 145000);
  });

  test('obtener() con id inexistente responde 404', async () => {
    const repoFalso = { obtenerConVariantes: async () => null };
    const controller = new ProductoController(new ProductoService({ productos: repoFalso }));
    const res = fakeRes();
    await controller.obtener({ params: { id: 'CAT9999' } }, res);
    assert.equal(res._status, 404);
  });

  test('listar() con repositorio que lanza error responde 500, no propaga la excepción', async () => {
    const repoRoto = { listarConVariantes: async () => { throw new Error('relation "catalogo_productos" does not exist'); } };
    const controller = new ProductoController(new ProductoService({ productos: repoRoto }));
    const res = fakeRes();
    await controller.listar({}, res);
    assert.equal(res._status, 500);
  });
});
