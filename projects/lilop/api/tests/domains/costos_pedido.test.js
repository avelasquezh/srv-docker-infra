const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const CostoPedidoRepository = require('../../src/domains/costos_pedido/CostoPedidoRepository');
const CostoPedidoService = require('../../src/domains/costos_pedido/CostoPedidoService');
const CostoPedidoController = require('../../src/domains/costos_pedido/CostoPedidoController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
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
  const controller = new CostoPedidoController(
    new CostoPedidoService({ costos: new CostoPedidoRepository(pool) })
  );
  return { pool, controller };
}

describe('CostoPedidoController — listado compuesto', () => {
  test('listar() devuelve {otros, domicilio, comision}, igual que el controller viejo', async () => {
    const { controller } = build({
      'FROM costos_pedido WHERE pedido_id': () => ({ rows: [{ id: 'CSP0001' }] }),
      'FROM entregas WHERE pedido_id': () => ({ rows: [{ id: 'EN0001' }] }),
      'FROM comisiones WHERE pedido_id': () => ({ rows: [{ id: 'CM0001' }] }),
    });
    const res = fakeRes();
    await controller.listar({ params: { pedido_id: 'PD0001' } }, res);
    assert.deepEqual(res._json, { otros: [{ id: 'CSP0001' }], domicilio: [{ id: 'EN0001' }], comision: [{ id: 'CM0001' }] });
  });
});

describe('CostoPedidoController — otros costos', () => {
  test('agregarOtro() sin nombre/valor responde 400 sin tocar la BD', async () => {
    const { controller, pool } = build({});
    const res = fakeRes();
    await controller.agregarOtro({ params: { pedido_id: 'PD0001' }, body: {} }, res);
    assert.equal(res._status, 400);
    assert.equal(pool.calls.length, 0);
  });

  test('agregarOtro() válido responde 201 con la fila insertada', async () => {
    const { controller } = build({
      'INSERT INTO costos_pedido': (p) => ({ rows: [{ id: 'CSP0099', pedido_id: p[0], nombre: p[1], valor: p[2] }] }),
    });
    const res = fakeRes();
    await controller.agregarOtro({ params: { pedido_id: 'PD0001' }, body: { nombre: 'Empaque', valor: 3000 } }, res);
    assert.equal(res._status, 201);
    assert.equal(res._json.id, 'CSP0099');
  });
});

describe('CostoPedidoController — domicilio', () => {
  test('agregarDomicilio() sin valor responde 400', async () => {
    const { controller } = build({});
    const res = fakeRes();
    await controller.agregarDomicilio({ params: { pedido_id: 'PD0001' }, body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('agregarDomicilio() válido hace un solo INSERT — NO duplica el rollup del trigger de prod (ver migración 007 y entrada #29 del MD)', async () => {
    const { controller, pool } = build({
      'INSERT INTO entregas': (p) => ({ rows: [{ id: 'EN0099', pedido_id: p[0] }] }),
    });
    const res = fakeRes();
    await controller.agregarDomicilio({ params: { pedido_id: 'PD0001' }, body: { valor_domicilio: 8000 } }, res);
    assert.equal(res._status, 201);
    assert.equal(pool.calls.length, 1);
    assert.match(pool.calls[0].sql, /INSERT INTO entregas/);
  });

  test('cambiarEstadoPagoDomicilio() con estado inválido responde 400', async () => {
    const { controller } = build({});
    const res = fakeRes();
    await controller.cambiarEstadoPagoDomicilio({ params: { id: 'EN0001' }, body: { estado_pago: 'Nope' } }, res);
    assert.equal(res._status, 400);
  });

  test('cambiarEstadoPagoDomicilio() con id inexistente responde 404', async () => {
    const { controller } = build({ 'UPDATE entregas SET estado_pago': () => ({ rows: [] }) });
    const res = fakeRes();
    await controller.cambiarEstadoPagoDomicilio({ params: { id: 'EN9999' }, body: { estado_pago: 'Pagado' } }, res);
    assert.equal(res._status, 404);
  });

  test('cambiarEstadoPagoDomicilio() exitoso responde 200 con la fila actualizada', async () => {
    const { controller } = build({ 'UPDATE entregas SET estado_pago': () => ({ rows: [{ id: 'EN0001', estado_pago: 'Pagado' }] }) });
    const res = fakeRes();
    await controller.cambiarEstadoPagoDomicilio({ params: { id: 'EN0001' }, body: { estado_pago: 'Pagado' } }, res);
    assert.equal(res._status, 200);
    assert.equal(res._json.estado_pago, 'Pagado');
  });
});

describe('CostoPedidoController — comisiones manuales', () => {
  test('agregarComision() sin valor responde 400 sin tocar la BD', async () => {
    const { controller, pool } = build({});
    const res = fakeRes();
    await controller.agregarComision({ params: { pedido_id: 'PD0001' }, body: {} }, res);
    assert.equal(res._status, 400);
    assert.equal(pool.calls.length, 0);
  });

  test('agregarComision() válida hace un solo INSERT — NO duplica el rollup del trigger de prod (ver migración 004 y entrada #29 del MD)', async () => {
    const { controller, pool } = build({});
    const res = fakeRes();
    await controller.agregarComision({ params: { pedido_id: 'PD0001' }, body: { valor_comision: 15000, nombre_vendedor: 'Ana' } }, res);
    assert.equal(res._status, 200);
    assert.deepEqual(res._json, { ok: true });
    assert.equal(pool.calls.length, 1);
    assert.match(pool.calls[0].sql, /INSERT INTO comisiones/);
  });

  test('cambiarEstadoComision() con id inexistente responde 404', async () => {
    const { controller } = build({ 'UPDATE comisiones SET estado': () => ({ rows: [] }) });
    const res = fakeRes();
    await controller.cambiarEstadoComision({ params: { id: 'CM9999' }, body: { estado: 'Pagada' } }, res);
    assert.equal(res._status, 404);
  });
});

describe('CostoPedidoController — listas auxiliares', () => {
  test('listaDomiciliarios/listaVendedoresComision/listaConceptosOtros devuelven arrays planos de strings', async () => {
    const { controller } = build({
      'DISTINCT domiciliario': () => ({ rows: [{ domiciliario: 'Pepe' }, { domiciliario: 'Luis' }] }),
      'DISTINCT nombre_vendedor': () => ({ rows: [{ nombre_vendedor: 'Ana' }] }),
      'FROM conceptos_costo': () => ({ rows: [{ nombre: 'Empaque' }, { nombre: 'Transporte' }] }),
    });
    const resD = fakeRes(); await controller.listaDomiciliarios({}, resD);
    const resV = fakeRes(); await controller.listaVendedoresComision({}, resV);
    const resC = fakeRes(); await controller.listaConceptosOtros({}, resC);
    assert.deepEqual(resD._json, ['Pepe', 'Luis']);
    assert.deepEqual(resV._json, ['Ana']);
    assert.deepEqual(resC._json, ['Empaque', 'Transporte']);
  });
});

describe('CostoPedidoController — manejo de errores', () => {
  test('error de BD responde 500 genérico vía BaseController.handle, sin propagar la excepción', async () => {
    const pool = { query: async () => { throw new Error('conexión perdida'); } };
    const controller = new CostoPedidoController(
      new CostoPedidoService({ costos: new CostoPedidoRepository(pool) })
    );
    const res = fakeRes();
    await controller.agregarOtro({ params: { pedido_id: 'PD0001' }, body: { nombre: 'X', valor: 100 } }, res);
    assert.equal(res._status, 500);
    assert.deepEqual(res._json, { error: 'Error interno del servidor' });
  });
});
