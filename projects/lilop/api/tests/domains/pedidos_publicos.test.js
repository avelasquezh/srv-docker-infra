const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const PedidoPublicoService = require('../../src/domains/pedidos_publicos/PedidoPublicoService');
const PedidoPublicoController = require('../../src/domains/pedidos_publicos/PedidoPublicoController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

const DATOS_VALIDOS = () => ({
  firstName: 'Ana', lastName: 'Gómez', email: 'ana@test.com', phone: '3001234567',
  city: 'Bogotá', department: 'Cundinamarca', localidad: 'Chapinero', address: 'Calle 1',
  neighborhood: 'Centro', apartment: '101', notes: '', paymentMethod: 'transfer',
  items: [{ name: 'Edredón', variant: 'Tamaño: Queen', price: 150000, quantity: 1 }],
  deliveryDate: '2099-01-01', // siempre futuro, evita depender de la fecha real
});

describe('PedidoPublicoService', () => {
  test('extraerTamanio() encuentra el tamaño dentro del string variant', () => {
    const s = new PedidoPublicoService({});
    assert.equal(s.extraerTamanio('Tamaño: Queen'), 'Queen');
    assert.equal(s.extraerTamanio('Tamaño: Semidoble'), 'Semidoble');
    assert.equal(s.extraerTamanio(null), null);
    assert.equal(s.extraerTamanio('sin tamaño válido'), null);
  });

  test('crear() reutiliza cliente existente por celular (no crea uno nuevo)', async () => {
    const llamadas = [];
    const repoFalso = {
      transaction: async (fn) => fn({}),
      buscarClientePorCelular: async () => 'CL0001',
      actualizarCliente: async () => { llamadas.push('actualizar'); },
      crearCliente: async () => { llamadas.push('crearCliente'); return 'NUNCA'; },
      obtenerMedioPagoId: async () => 'MP0001',
      crearPedido: async () => 'PD0099',
      crearProducto: async () => { llamadas.push('crearProducto'); },
    };
    const service = new PedidoPublicoService({ pedidosPublicos: repoFalso });
    const resultado = await service.crear(DATOS_VALIDOS());
    assert.deepEqual(resultado, { pedidoId: 'PD0099', clienteId: 'CL0001' });
    assert.deepEqual(llamadas, ['actualizar', 'crearProducto']);
  });

  test('crear() crea cliente nuevo si no existe por celular', async () => {
    const repoFalso = {
      transaction: async (fn) => fn({}),
      buscarClientePorCelular: async () => null,
      crearCliente: async () => 'CL0099',
      obtenerMedioPagoId: async () => null,
      crearPedido: async () => 'PD0100',
      crearProducto: async () => {},
    };
    const service = new PedidoPublicoService({ pedidosPublicos: repoFalso });
    const resultado = await service.crear(DATOS_VALIDOS());
    assert.equal(resultado.clienteId, 'CL0099');
  });

  test('crear() calcula valorVentaOverride como price * quantity', async () => {
    let capturado;
    const repoFalso = {
      transaction: async (fn) => fn({}),
      buscarClientePorCelular: async () => 'CL0001',
      actualizarCliente: async () => {},
      obtenerMedioPagoId: async () => null,
      crearPedido: async () => 'PD0001',
      crearProducto: async (client, pedidoId, datos) => { capturado = datos; },
    };
    const service = new PedidoPublicoService({ pedidosPublicos: repoFalso });
    const datos = DATOS_VALIDOS();
    datos.items = [{ name: 'X', variant: 'Tamaño: King', price: 50000, quantity: 3 }];
    await service.crear(datos);
    assert.equal(capturado.valorVentaOverride, 150000);
    assert.equal(capturado.cantidad, 3);
  });
});

describe('PedidoPublicoController — validaciones (mismas reglas que el original)', () => {
  function controllerConService(overrides = {}) {
    const service = { crear: async () => ({ pedidoId: 'PD0001', clienteId: 'CL0001' }), getMinFechaEntrega: () => '2020-01-01', ...overrides };
    return new PedidoPublicoController(service);
  }

  test('sin campos obligatorios del cliente responde 400', async () => {
    const controller = controllerConService();
    const res = fakeRes();
    await controller.crear({ body: { ...DATOS_VALIDOS(), firstName: '' } }, res);
    assert.equal(res._status, 400);
  });

  test('sin items responde 400', async () => {
    const controller = controllerConService();
    const res = fakeRes();
    await controller.crear({ body: { ...DATOS_VALIDOS(), items: [] } }, res);
    assert.equal(res._status, 400);
  });

  test('sin deliveryDate responde 400', async () => {
    const controller = controllerConService();
    const res = fakeRes();
    await controller.crear({ body: { ...DATOS_VALIDOS(), deliveryDate: '' } }, res);
    assert.equal(res._status, 400);
  });

  test('con fecha de entrega anterior al mínimo responde 400', async () => {
    const controller = controllerConService({ getMinFechaEntrega: () => '2099-06-01' });
    const res = fakeRes();
    await controller.crear({ body: { ...DATOS_VALIDOS(), deliveryDate: '2099-01-01' } }, res);
    assert.equal(res._status, 400);
  });

  test('happy path responde 201 con pedido_id/cliente_id', async () => {
    const controller = controllerConService();
    const res = fakeRes();
    await controller.crear({ body: DATOS_VALIDOS() }, res);
    assert.equal(res._status, 201);
    assert.deepEqual(res._json, { ok: true, pedido_id: 'PD0001', cliente_id: 'CL0001' });
  });
});
