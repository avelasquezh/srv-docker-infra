const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const UsuarioRepository = require('../../src/domains/usuarios/UsuarioRepository');
const { UsuarioService, EmailDuplicadoError } = require('../../src/domains/usuarios/UsuarioService');
const UsuarioController = require('../../src/domains/usuarios/UsuarioController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

const bcryptFalso = { hash: async (p) => `HASH(${p})` };

function poolFalso(escenario = 'ok') {
  return {
    query: async (sql, params) => {
      if (escenario === 'duplicado' && /INSERT|UPDATE/.test(sql)) {
        const err = new Error('dup'); err.code = '23505'; throw err;
      }
      if (/SELECT .* FROM usuarios ORDER BY created_at/.test(sql)) return { rows: [{ id: 1, nombre: 'Ana' }] };
      if (/SELECT .* FROM usuarios WHERE id = \$1/.test(sql)) {
        return { rows: params[0] === '999' ? [] : [{ id: params[0], nombre: 'Ana' }] };
      }
      if (/INSERT INTO usuarios/.test(sql)) return { rows: [{ id: 2, nombre: params[0] }] };
      if (/UPDATE usuarios SET\s+nombre/.test(sql)) {
        return { rows: params[6] === '999' ? [] : [{ id: params[6], nombre: params[0] }] };
      }
      if (/UPDATE usuarios SET password/.test(sql)) return { rows: params[1] === '999' ? [] : [{ id: params[1] }] };
      if (/DELETE FROM usuarios/.test(sql)) return { rows: params[0] === '999' ? [] : [{ id: params[0] }] };
      return { rows: [] };
    },
  };
}

function buildController(escenario) {
  const repo = new UsuarioRepository(poolFalso(escenario));
  const service = new UsuarioService({ usuarios: repo }, { bcrypt: bcryptFalso });
  return new UsuarioController(service);
}

describe('UsuarioService', () => {
  test('constructor lanza si falta bcrypt inyectado', () => {
    assert.throws(() => new UsuarioService({}, {}));
  });

  test('crear() aplica toTitleCase al nombre', async () => {
    let capturado;
    const repoFalso = { crear: async (datos) => { capturado = datos; return { id: 1 }; } };
    const service = new UsuarioService({ usuarios: repoFalso }, { bcrypt: bcryptFalso });
    await service.crear({ nombre: '  juan perez  ', password: '123' });
    assert.equal(capturado.nombre, 'Juan Perez');
    assert.equal(capturado.passwordHash, 'HASH(123)');
  });

  test('crear() traduce 23505 a EmailDuplicadoError', async () => {
    const repoFalso = { crear: async () => { const e = new Error('dup'); e.code = '23505'; throw e; } };
    const service = new UsuarioService({ usuarios: repoFalso }, { bcrypt: bcryptFalso });
    await assert.rejects(() => service.crear({ nombre: 'X' }), EmailDuplicadoError);
  });
});

describe('UsuarioController', () => {
  test('listar() responde 200 con el array del repo', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.listar({}, res);
    assert.equal(res._status, 200);
    assert.equal(res._json.length, 1);
  });

  test('obtener() con id inexistente responde 404', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.obtener({ params: { id: '999' } }, res);
    assert.equal(res._status, 404);
  });

  test('crear() sin nombre responde 400', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.crear({ body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('crear() duplicado responde 400 con mensaje de email', async () => {
    const c = buildController('duplicado');
    const res = fakeRes();
    await c.crear({ body: { nombre: 'X', email: 'dup@x.com' } }, res);
    assert.equal(res._status, 400);
    assert.equal(res._json.error, 'El email ya está registrado');
  });

  test('actualizar() con id inexistente responde 404', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.actualizar({ params: { id: '999' }, body: { nombre: 'X' } }, res);
    assert.equal(res._status, 404);
  });

  test('cambiarPassword() sin password responde 400', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.cambiarPassword({ params: { id: '1' }, body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('cambiarPassword() con id inexistente responde 404', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.cambiarPassword({ params: { id: '999' }, body: { password: 'x' } }, res);
    assert.equal(res._status, 404);
  });

  test('eliminar() con id inexistente responde 404', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.eliminar({ params: { id: '999' } }, res);
    assert.equal(res._status, 404);
  });

  test('happy path: crear() responde 201 con el usuario creado', async () => {
    const c = buildController('ok');
    const res = fakeRes();
    await c.crear({ body: { nombre: 'juan', password: '123', email: 'j@x.com' } }, res);
    assert.equal(res._status, 201);
    assert.equal(res._json.nombre, 'Juan');
  });
});
