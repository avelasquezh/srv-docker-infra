const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const EntregaService = require('../../src/domains/entregas/EntregaService');
const EntregaController = require('../../src/domains/entregas/EntregaController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

describe('EntregaController', () => {
  test('crear() con pedido inexistente responde 404 sin llegar a insertar', async () => {
    let seCreo = false;
    const repoFalso = { pedidoExiste: async () => false, crear: async () => { seCreo = true; } };
    const controller = new EntregaController(new EntregaService({ entregas: repoFalso }));
    const res = fakeRes();
    await controller.crear({ params: { pedido_id: 'PD9999' }, body: {} }, res);
    assert.equal(res._status, 404);
    assert.equal(seCreo, false);
  });

  test('crear() happy path responde 201', async () => {
    const repoFalso = { pedidoExiste: async () => true, crear: async () => ({ id: 'EN0001', estado: 'Pendiente' }) };
    const controller = new EntregaController(new EntregaService({ entregas: repoFalso }));
    const res = fakeRes();
    await controller.crear({ params: { pedido_id: 'PD0001' }, body: {} }, res);
    assert.equal(res._status, 201);
  });

  test('obtener() con id inexistente responde 404', async () => {
    const repoFalso = { obtenerPorId: async () => null };
    const controller = new EntregaController(new EntregaService({ entregas: repoFalso }));
    const res = fakeRes();
    await controller.obtener({ params: { id: 'EN9999' } }, res);
    assert.equal(res._status, 404);
  });

  test('actualizar() con id inexistente responde 404', async () => {
    const repoFalso = { actualizar: async () => null };
    const controller = new EntregaController(new EntregaService({ entregas: repoFalso }));
    const res = fakeRes();
    await controller.actualizar({ params: { id: 'EN9999' }, body: {} }, res);
    assert.equal(res._status, 404);
  });

  test('eliminar() con id inexistente responde 404; ok responde mensaje', async () => {
    const controller = new EntregaController(new EntregaService({ entregas: { eliminar: async () => null } }));
    const res = fakeRes();
    await controller.eliminar({ params: { id: 'EN9999' } }, res);
    assert.equal(res._status, 404);

    const controllerOk = new EntregaController(new EntregaService({ entregas: { eliminar: async () => ({ id: 'EN0001' }) } }));
    const res2 = fakeRes();
    await controllerOk.eliminar({ params: { id: 'EN0001' } }, res2);
    assert.deepEqual(res2._json, { mensaje: 'Entrega eliminada correctamente' });
  });
});
