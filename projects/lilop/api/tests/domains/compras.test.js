const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CompraService = require('../../src/domains/compras/CompraService');
const CompraController = require('../../src/domains/compras/CompraController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

describe('CompraController', () => {
  test('crear() sin cantidad/valor_unitario responde 400', async () => {
    const controller = new CompraController(new CompraService({}));
    const res = fakeRes();
    await controller.crear({ params: { producto_id: 'PR0001' }, body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('crear() con producto inexistente responde 404, no llega a insertar', async () => {
    let seCreo = false;
    const repoFalso = { productoExiste: async () => false, crear: async () => { seCreo = true; } };
    const controller = new CompraController(new CompraService({ compras: repoFalso }));
    const res = fakeRes();
    await controller.crear({ params: { producto_id: 'PR9999' }, body: { cantidad: 1, valor_unitario: 100 } }, res);
    assert.equal(res._status, 404);
    assert.equal(seCreo, false);
  });

  test('crear() happy path responde 201', async () => {
    const repoFalso = { productoExiste: async () => true, crear: async () => ({ id: 'CP0001' }) };
    const controller = new CompraController(new CompraService({ compras: repoFalso }));
    const res = fakeRes();
    await controller.crear({ params: { producto_id: 'PR0001' }, body: { cantidad: 1, valor_unitario: 100 } }, res);
    assert.equal(res._status, 201);
  });

  test('obtener()/actualizar()/eliminar() con id inexistente responden 404', async () => {
    const repoFalso = { obtenerPorId: async () => null, actualizar: async () => null, eliminar: async () => null };
    const controller = new CompraController(new CompraService({ compras: repoFalso }));
    for (const metodo of ['obtener', 'actualizar', 'eliminar']) {
      const res = fakeRes();
      await controller[metodo]({ params: { id: 'CP9999' }, body: {} }, res);
      assert.equal(res._status, 404, metodo);
    }
  });
});
