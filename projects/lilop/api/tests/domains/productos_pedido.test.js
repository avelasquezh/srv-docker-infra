const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ProductoPedidoService = require('../../src/domains/productos_pedido/ProductoPedidoService');
const ProductoPedidoController = require('../../src/domains/productos_pedido/ProductoPedidoController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

describe('ProductoPedidoService', () => {
  test('crear() calcula el precio del catálogo (nombre+tamaño x cantidad) cuando hay precio', async () => {
    let capturado;
    const repoFalso = {
      precioCatalogo: async () => 15000,
      crear: async (d) => { capturado = d; return d; },
    };
    await new ProductoPedidoService({ productos: repoFalso }).crear('PD0001', { nombre: 'Camiseta', tamanio: 'M', cantidad: 3 });
    assert.equal(capturado.valorVentaOverride, 45000);
    assert.equal(capturado.cantidad, 3);
  });

  test('crear() sin match en el catálogo deja valorVentaOverride en null', async () => {
    let capturado;
    const repoFalso = { precioCatalogo: async () => null, crear: async (d) => { capturado = d; return d; } };
    await new ProductoPedidoService({ productos: repoFalso }).crear('PD0001', { nombre: 'Producto Nuevo', cantidad: 2 });
    assert.equal(capturado.valorVentaOverride, null);
  });

  test('crear() sin cantidad usa 1 por defecto', async () => {
    let capturado;
    const repoFalso = { precioCatalogo: async () => 10000, crear: async (d) => { capturado = d; return d; } };
    await new ProductoPedidoService({ productos: repoFalso }).crear('PD0001', { nombre: 'X' });
    assert.equal(capturado.cantidad, 1);
    assert.equal(capturado.valorVentaOverride, 10000);
  });

  test('actualizar() con override explícito NO recalcula del catálogo', async () => {
    let seConsultoPrecio = false;
    let capturado;
    const repoFalso = {
      precioCatalogo: async () => { seConsultoPrecio = true; return 99999; },
      actualizar: async (id, d) => { capturado = d; return d; },
    };
    await new ProductoPedidoService({ productos: repoFalso }).actualizar('PR0001', { valor_venta_override: 5000 });
    assert.equal(seConsultoPrecio, false);
    assert.equal(capturado.valorVentaOverride, 5000);
  });

  test('actualizar() con override explícito null SÍ recalcula (fidelidad al original: !== undefined, no truthy)', async () => {
    let seConsultoPrecio = false;
    const repoFalso = {
      camposActuales: async () => ({ nombre: 'Camiseta', tamanio: 'M', cantidad: 2 }),
      precioCatalogo: async () => { seConsultoPrecio = true; return 8000; },
      actualizar: async (id, d) => d,
    };
    await new ProductoPedidoService({ productos: repoFalso }).actualizar('PR0001', { valor_venta_override: null });
    assert.equal(seConsultoPrecio, true);
  });

  test('actualizar() sin override, sin nombre/tamaño nuevos, usa los campos actuales del producto', async () => {
    let nombreUsado, tamanioUsado;
    const repoFalso = {
      camposActuales: async () => ({ nombre: 'Camiseta', tamanio: 'L', cantidad: 4 }),
      precioCatalogo: async (n, t) => { nombreUsado = n; tamanioUsado = t; return 7000; },
      actualizar: async (id, d) => d,
    };
    await new ProductoPedidoService({ productos: repoFalso }).actualizar('PR0001', {});
    assert.equal(nombreUsado, 'Camiseta');
    assert.equal(tamanioUsado, 'L');
  });
});

describe('ProductoPedidoController', () => {
  test('crear() sin nombre responde 400, no valida pedido ni crea', async () => {
    let seValidoPedido = false;
    const repoFalso = { pedidoExiste: async () => { seValidoPedido = true; return true; } };
    const controller = new ProductoPedidoController(new ProductoPedidoService({ productos: repoFalso }));
    const res = fakeRes();
    await controller.crear({ params: { pedido_id: 'PD0001' }, body: {} }, res);
    assert.equal(res._status, 400);
    assert.equal(seValidoPedido, false);
  });

  test('crear() con pedido_id inexistente responde 404, no llega a crear', async () => {
    let seCreo = false;
    const repoFalso = { pedidoExiste: async () => false, crear: async () => { seCreo = true; } };
    const controller = new ProductoPedidoController(new ProductoPedidoService({ productos: repoFalso }));
    const res = fakeRes();
    await controller.crear({ params: { pedido_id: 'PD9999' }, body: { nombre: 'Camiseta' } }, res);
    assert.equal(res._status, 404);
    assert.equal(seCreo, false);
  });

  test('obtener() con id inexistente responde 404', async () => {
    const repoFalso = { obtenerPorId: async () => null };
    const controller = new ProductoPedidoController(new ProductoPedidoService({ productos: repoFalso }));
    const res = fakeRes();
    await controller.obtener({ params: { id: 'PR9999' } }, res);
    assert.equal(res._status, 404);
  });

  test('obtener() happy path incluye las compras', async () => {
    const repoFalso = {
      obtenerPorId: async () => ({ id: 'PR0001', nombre: 'Camiseta' }),
      comprasDe: async () => [{ id: 'CO0001', valor_total: 5000 }],
    };
    const controller = new ProductoPedidoController(new ProductoPedidoService({ productos: repoFalso }));
    const res = fakeRes();
    await controller.obtener({ params: { id: 'PR0001' } }, res);
    assert.equal(res._json.compras.length, 1);
  });

  test('eliminar() con id inexistente responde 404', async () => {
    const repoFalso = { eliminar: async () => null };
    const controller = new ProductoPedidoController(new ProductoPedidoService({ productos: repoFalso }));
    const res = fakeRes();
    await controller.eliminar({ params: { id: 'PR9999' } }, res);
    assert.equal(res._status, 404);
  });

  test('catalogo() devuelve la lista de nombres', async () => {
    const repoFalso = { catalogoNombres: async () => ['Camiseta', 'Buzo'] };
    const controller = new ProductoPedidoController(new ProductoPedidoService({ productos: repoFalso }));
    const res = fakeRes();
    await controller.catalogo({}, res);
    assert.deepEqual(res._json, ['Camiseta', 'Buzo']);
  });
});
