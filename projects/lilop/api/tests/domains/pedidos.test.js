const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { PedidoService, MedioPagoInvalidoError } = require('../../src/domains/pedidos/PedidoService');
const PedidoController = require('../../src/domains/pedidos/PedidoController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

describe('PedidoService', () => {
  test('resolverMedioPago() sin nombre devuelve null, no consulta el repo', async () => {
    let seConsulto = false;
    const repoFalso = { buscarMedioPago: async () => { seConsulto = true; return 1; } };
    const id = await new PedidoService({ pedidos: repoFalso }).resolverMedioPago(undefined);
    assert.equal(id, null);
    assert.equal(seConsulto, false);
  });

  test('resolverMedioPago() con nombre válido devuelve el id', async () => {
    const repoFalso = { buscarMedioPago: async (n) => (n === 'Nequi' ? 2 : null) };
    const id = await new PedidoService({ pedidos: repoFalso }).resolverMedioPago('Nequi');
    assert.equal(id, 2);
  });

  test('resolverMedioPago() con nombre inválido lanza MedioPagoInvalidoError', async () => {
    const repoFalso = { buscarMedioPago: async () => null };
    await assert.rejects(
      () => new PedidoService({ pedidos: repoFalso }).resolverMedioPago('Bitcoin'),
      MedioPagoInvalidoError
    );
  });

  test('obtener() con id inexistente devuelve null sin consultar productos', async () => {
    let seConsultoProductos = false;
    const repoFalso = {
      obtenerResumen: async () => null,
      productosConCompras: async () => { seConsultoProductos = true; return []; },
    };
    const pedido = await new PedidoService({ pedidos: repoFalso }).obtener('PD9999');
    assert.equal(pedido, null);
    assert.equal(seConsultoProductos, false);
  });

  test('obtener() happy path combina resumen + productos', async () => {
    const repoFalso = {
      obtenerResumen: async () => ({ id: 'PD0001', cliente: 'Ana' }),
      productosConCompras: async () => [{ id: 'PR0001' }],
    };
    const pedido = await new PedidoService({ pedidos: repoFalso }).obtener('PD0001');
    assert.equal(pedido.cliente, 'Ana');
    assert.equal(pedido.productos.length, 1);
  });
});

describe('PedidoController', () => {
  test('crear() sin cliente_id/vendedor_id/valor_venta responde 400, no llega al service', async () => {
    let seLlamo = false;
    const repoFalso = { crear: async () => { seLlamo = true; } };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.crear({ body: {} }, res);
    assert.equal(res._status, 400);
    assert.equal(seLlamo, false);
  });

  test('crear() con medio_pago inválido responde 400, no llega a insertar', async () => {
    let seInserto = false;
    const repoFalso = {
      buscarMedioPago: async () => null,
      crear: async () => { seInserto = true; },
    };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.crear({ body: { cliente_id: 'CL0001', vendedor_id: 'US0001', valor_venta: 1000, medio_pago: 'Bitcoin' } }, res);
    assert.equal(res._status, 400);
    assert.equal(res._json.error, 'medio_pago inválido');
    assert.equal(seInserto, false);
  });

  test('crear() happy path sin medio_pago responde 201', async () => {
    const repoFalso = { crear: async (d) => ({ id: 'PD0001', ...d }) };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.crear({ body: { cliente_id: 'CL0001', vendedor_id: 'US0001', valor_venta: 1000 } }, res);
    assert.equal(res._status, 201);
  });

  test('crear() con valor_venta = 0 no responde 400 (fidelidad: chequeo explícito de undefined/null, no falsy)', async () => {
    const repoFalso = { crear: async (d) => ({ id: 'PD0001', ...d }) };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.crear({ body: { cliente_id: 'CL0001', vendedor_id: 'US0001', valor_venta: 0 } }, res);
    assert.equal(res._status, 201);
  });

  test('actualizar() con medio_pago inválido responde 400, no llega a actualizar', async () => {
    let seActualizo = false;
    const repoFalso = {
      buscarMedioPago: async () => null,
      actualizar: async () => { seActualizo = true; },
    };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.actualizar({ params: { id: 'PD0001' }, body: { medio_pago: 'Bitcoin' } }, res);
    assert.equal(res._status, 400);
    assert.equal(seActualizo, false);
  });

  test('actualizar() con id inexistente responde 404', async () => {
    const repoFalso = { actualizar: async () => null };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.actualizar({ params: { id: 'PD9999' }, body: {} }, res);
    assert.equal(res._status, 404);
  });

  test('cambiarEstado() sin estado responde 400', async () => {
    const controller = new PedidoController(new PedidoService({}));
    const res = fakeRes();
    await controller.cambiarEstado({ params: { id: 'PD0001' }, body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('cambiarEstado() con id inexistente responde 404', async () => {
    const repoFalso = { cambiarEstado: async () => null };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.cambiarEstado({ params: { id: 'PD9999' }, body: { estado: 'entregado' } }, res);
    assert.equal(res._status, 404);
  });

  test('cambiarEstado() happy path', async () => {
    const repoFalso = { cambiarEstado: async (id, estado) => ({ id, estado }) };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.cambiarEstado({ params: { id: 'PD0001' }, body: { estado: 'entregado' } }, res);
    assert.deepEqual(res._json, { id: 'PD0001', estado: 'entregado' });
  });

  test('eliminar() con id inexistente responde 404', async () => {
    const repoFalso = { eliminar: async () => null };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.eliminar({ params: { id: 'PD9999' } }, res);
    assert.equal(res._status, 404);
  });

  test('eliminar() happy path', async () => {
    const repoFalso = { eliminar: async () => ({ id: 'PD0001' }) };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.eliminar({ params: { id: 'PD0001' } }, res);
    assert.deepEqual(res._json, { mensaje: 'Pedido eliminado correctamente' });
  });

  test('obtener() con id inexistente responde 404', async () => {
    const repoFalso = { obtenerResumen: async () => null };
    const controller = new PedidoController(new PedidoService({ pedidos: repoFalso }));
    const res = fakeRes();
    await controller.obtener({ params: { id: 'PD9999' } }, res);
    assert.equal(res._status, 404);
  });
});
