const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const BaseRepository = require('../src/core/BaseRepository');
const BaseService = require('../src/core/BaseService');
const BaseController = require('../src/core/BaseController');

describe('BaseRepository', () => {
  test('lanza error si no se inyecta un pool', () => {
    assert.throws(() => new BaseRepository(), /se requiere un pool de conexión inyectado/);
  });

  test('query() delega en pool.query con los mismos argumentos', async () => {
    let capturado = null;
    const poolFalso = { query: async (sql, params) => { capturado = { sql, params }; return { rows: [] }; } };
    const repo = new BaseRepository(poolFalso);
    await repo.query('SELECT 1', [42]);
    assert.deepEqual(capturado, { sql: 'SELECT 1', params: [42] });
  });
});

describe('BaseService', () => {
  test('guarda los repositorios inyectados accesibles por nombre', () => {
    const repoFalso = { existo: true };
    const service = new BaseService({ productos: repoFalso });
    assert.equal(service.repos.productos, repoFalso);
  });

  test('sin argumentos, repos queda como objeto vacío (no undefined)', () => {
    const service = new BaseService();
    assert.deepEqual(service.repos, {});
  });
});

describe('BaseController', () => {
  function fakeRes() {
    return {
      _status: 200, _json: null,
      status(c) { this._status = c; return this; },
      json(o) { this._json = o; return this; },
      set() { return this; },
    };
  }

  test('handle() ejecuta el handler feliz sin alterar la respuesta', async () => {
    const controller = new BaseController({});
    const res = fakeRes();
    const wrapped = controller.handle(async (req, r) => { r.json({ ok: true }); });
    await wrapped({}, res);
    assert.deepEqual(res._json, { ok: true });
    assert.equal(res._status, 200);
  });

  test('handle() captura errores y responde 500 genérico, sin tumbar el proceso', async () => {
    const controller = new BaseController({});
    const res = fakeRes();
    const wrapped = controller.handle(async () => { throw new Error('boom'); });
    await wrapped({}, res);
    assert.equal(res._status, 500);
    assert.deepEqual(res._json, { error: 'Error interno del servidor' });
  });

  test('notFound() responde 404 con el mensaje dado', () => {
    const controller = new BaseController({});
    const res = fakeRes();
    controller.notFound(res, 'no está');
    assert.equal(res._status, 404);
    assert.deepEqual(res._json, { error: 'no está' });
  });

  test('notFound() usa un mensaje genérico por defecto', () => {
    const controller = new BaseController({});
    const res = fakeRes();
    controller.notFound(res);
    assert.deepEqual(res._json, { error: 'Recurso no encontrado' });
  });
});
