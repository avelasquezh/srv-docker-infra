const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ComisionRepository = require('../../src/domains/comisiones/ComisionRepository');
const ComisionService = require('../../src/domains/comisiones/ComisionService');
const ComisionController = require('../../src/domains/comisiones/ComisionController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

describe('ComisionRepository', () => {
  test('listar() sin filtros no agrega condiciones extra', async () => {
    let capturado;
    const pool = { query: async (sql, params) => { capturado = { sql, params }; return { rows: [] }; } };
    await new ComisionRepository(pool).listar({});
    assert.deepEqual(capturado.params, []);
    assert.ok(!capturado.sql.includes('vendedor_id = $'));
  });

  test('listar() con ambos filtros arma 2 condiciones con params en orden', async () => {
    let capturado;
    const pool = { query: async (sql, params) => { capturado = { sql, params }; return { rows: [] }; } };
    await new ComisionRepository(pool).listar({ vendedorId: 'US0001', estado: 'Pendiente' });
    assert.deepEqual(capturado.params, ['US0001', 'Pendiente']);
    assert.match(capturado.sql, /vendedor_id = \$1/);
    assert.match(capturado.sql, /estado = \$2/);
  });
});

describe('ComisionController', () => {
  test('cambiarEstado() sin estado responde 400', async () => {
    const controller = new ComisionController(new ComisionService({}));
    const res = fakeRes();
    await controller.cambiarEstado({ params: { id: 'CM0001' }, body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('cambiarEstado() con id inexistente responde 404', async () => {
    const repoFalso = { cambiarEstado: async () => null };
    const controller = new ComisionController(new ComisionService({ comisiones: repoFalso }));
    const res = fakeRes();
    await controller.cambiarEstado({ params: { id: 'CM9999' }, body: { estado: 'Pagada' } }, res);
    assert.equal(res._status, 404);
  });

  test('obtener() con id inexistente responde 404', async () => {
    const repoFalso = { obtenerPorId: async () => null };
    const controller = new ComisionController(new ComisionService({ comisiones: repoFalso }));
    const res = fakeRes();
    await controller.obtener({ params: { id: 'CM9999' } }, res);
    assert.equal(res._status, 404);
  });

  test('happy path: cambiarEstado() responde con la fila actualizada', async () => {
    const repoFalso = { cambiarEstado: async () => ({ id: 'CM0001', estado: 'Pagada', valor_comision: 15000 }) };
    const controller = new ComisionController(new ComisionService({ comisiones: repoFalso }));
    const res = fakeRes();
    await controller.cambiarEstado({ params: { id: 'CM0001' }, body: { estado: 'Pagada' } }, res);
    assert.equal(res._status, 200);
    assert.equal(res._json.estado, 'Pagada');
  });
});
