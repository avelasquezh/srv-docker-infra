const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const DisenoService = require('../../src/domains/disenos/DisenoService');
const DisenoController = require('../../src/domains/disenos/DisenoController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

describe('DisenoService.crear — generación de nombre', () => {
  test('con nombre dado, lo usa tal cual (trim)', async () => {
    let capturado;
    const repoFalso = { crear: async (datos) => { capturado = datos; return datos; } };
    const service = new DisenoService({ disenos: repoFalso });
    await service.crear({ nombre: '  Mi Diseño  ' });
    assert.equal(capturado.nombre, 'Mi Diseño');
  });

  test('sin nombre, genera uno automático con el prefijo esperado', async () => {
    let capturado;
    const repoFalso = { crear: async (datos) => { capturado = datos; return datos; } };
    const service = new DisenoService({ disenos: repoFalso });
    await service.crear({});
    assert.match(capturado.nombre, /^DISEÑO-[A-Z0-9]+$/);
  });
});

describe('DisenoController', () => {
  test('actualizarProductos() sin array responde 400', async () => {
    const controller = new DisenoController(new DisenoService({}));
    const res = fakeRes();
    await controller.actualizarProductos({ params: { id: 'D1' }, body: { catalogo_ids: 'no-es-array' } }, res);
    assert.equal(res._status, 400);
  });

  test('actualizarProductos() con array vacío responde ok (borra sin insertar)', async () => {
    let llamado;
    const repoFalso = { reemplazarProductos: async (id, ids) => { llamado = { id, ids }; } };
    const controller = new DisenoController(new DisenoService({ disenos: repoFalso }));
    const res = fakeRes();
    await controller.actualizarProductos({ params: { id: 'D1' }, body: { catalogo_ids: [] } }, res);
    assert.deepEqual(res._json, { ok: true });
    assert.deepEqual(llamado, { id: 'D1', ids: [] });
  });

  test('actualizar() con id inexistente responde 404', async () => {
    const repoFalso = { actualizar: async () => null };
    const controller = new DisenoController(new DisenoService({ disenos: repoFalso }));
    const res = fakeRes();
    await controller.actualizar({ params: { id: 'D9999' }, body: {} }, res);
    assert.equal(res._status, 404);
  });

  test('eliminar() con id inexistente responde 404', async () => {
    const repoFalso = { eliminar: async () => null };
    const controller = new DisenoController(new DisenoService({ disenos: repoFalso }));
    const res = fakeRes();
    await controller.eliminar({ params: { id: 'D9999' } }, res);
    assert.equal(res._status, 404);
  });
});
