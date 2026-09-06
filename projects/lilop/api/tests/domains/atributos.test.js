const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const AtributoService = require('../../src/domains/atributos/AtributoService');
const AtributoController = require('../../src/domains/atributos/AtributoController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

describe('AtributoService', () => {
  test('crear() trimea nombre y castea sobreprecio a número (default 0)', async () => {
    let capturado;
    const repoFalso = { crear: async (d) => { capturado = d; return d; } };
    await new AtributoService({ atributos: repoFalso }).crear({ nombre: '  Plumón  ', tipo: 'booleano' });
    assert.equal(capturado.nombre, 'Plumón');
    assert.equal(capturado.sobreprecio, 0);
  });
});

describe('AtributoController', () => {
  test('crear() sin nombre/tipo responde 400', async () => {
    const controller = new AtributoController(new AtributoService({}));
    const res = fakeRes();
    await controller.crear({ body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('crear() con duplicado (23505) responde 400 con mensaje específico', async () => {
    const repoFalso = { crear: async () => { throw Object.assign(new Error('dup'), { code: '23505' }); } };
    const controller = new AtributoController(new AtributoService({ atributos: repoFalso }));
    const res = fakeRes();
    await controller.crear({ body: { nombre: 'Plumón', tipo: 'booleano' } }, res);
    assert.equal(res._status, 400);
    assert.match(res._json.error, /ya existe/);
  });

  test('crearOpcion() sin nombre/valor responde 400', async () => {
    const controller = new AtributoController(new AtributoService({}));
    const res = fakeRes();
    await controller.crearOpcion({ params: { id: 'A1' }, body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('actualizarAtributosProducto() sin array responde 400', async () => {
    const controller = new AtributoController(new AtributoService({}));
    const res = fakeRes();
    await controller.actualizarAtributosProducto({ params: { catalogo_id: 'CAT0001' }, body: { atributo_ids: 'x' } }, res);
    assert.equal(res._status, 400);
  });

  test('actualizar() con id inexistente responde 404', async () => {
    const repoFalso = { actualizar: async () => null };
    const controller = new AtributoController(new AtributoService({ atributos: repoFalso }));
    const res = fakeRes();
    await controller.actualizar({ params: { id: 'A9999' }, body: {} }, res);
    assert.equal(res._status, 404);
  });
});
