const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ImagenRepository = require('../../src/domains/imagenes/ImagenRepository');
const ImagenService = require('../../src/domains/imagenes/ImagenService');
const ImagenController = require('../../src/domains/imagenes/ImagenController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

function sharpFalso() {
  const llamadas = [];
  const encadenable = { resize() { return encadenable; }, webp() { return encadenable; }, toFile: async (p) => { llamadas.push(p); } };
  const sharpFn = () => encadenable;
  sharpFn.llamadas = llamadas;
  return sharpFn;
}

describe('ImagenService — validaciones de forma', () => {
  const service = new ImagenService({});

  test('extensionValida(): acepta jpg/jpeg/png/webp', () => {
    for (const ext of ['foto.jpg', 'foto.JPEG', 'foto.png', 'foto.webp']) {
      assert.equal(service.extensionValida(ext), true, ext);
    }
  });

  test('extensionValida(): rechaza otros formatos (ej. gif, pdf)', () => {
    assert.equal(service.extensionValida('archivo.gif'), false);
    assert.equal(service.extensionValida('archivo.pdf'), false);
  });

  test('nombreArchivoSeguro(): rechaza path traversal', () => {
    assert.equal(service.nombreArchivoSeguro('../../etc/passwd'), false);
    assert.equal(service.nombreArchivoSeguro('sub/dir/foto.webp'), false);
  });

  test('nombreArchivoSeguro(): acepta nombre plano normal', () => {
    assert.equal(service.nombreArchivoSeguro('1234-abcde.webp'), true);
  });
});

describe('ImagenService — subir()', () => {
  test('genera optimizada + thumbnail y devuelve url/thumbnail', async () => {
    const repoFalso = { guardarOptimizada: async () => {}, guardarThumbnail: async () => {} };
    const service = new ImagenService({ imagenes: repoFalso });
    const resultado = await service.subir(Buffer.from('fake'));
    assert.match(resultado.url, /^\/uploads\/disenos\/.+\.webp$/);
    assert.match(resultado.thumbnail, /_thumb\.webp$/);
  });
});

describe('ImagenRepository', () => {
  test('exige uploadsDir inyectado', () => {
    assert.throws(() => new ImagenRepository(), /se requiere uploadsDir inyectado/);
  });

  test('guardarOptimizada() llama a sharp con resize+webp+toFile', async () => {
    const sharpFn = sharpFalso();
    const repo = new ImagenRepository('/tmp/uploads', sharpFn, {});
    await repo.guardarOptimizada(Buffer.from('x'), 'foto.webp');
    assert.equal(sharpFn.llamadas.length, 1);
    assert.match(sharpFn.llamadas[0], /uploads[\\/]foto\.webp$/);
  });

  test('eliminarSiExiste() no lanza si el archivo no existe', () => {
    const fsFalso = { existsSync: () => false, unlinkSync: () => { throw new Error('no debería llamarse'); } };
    const repo = new ImagenRepository('/tmp/uploads', sharpFalso(), fsFalso);
    assert.doesNotThrow(() => repo.eliminarSiExiste('no-existe.webp'));
  });

  test('eliminarSiExiste() borra si el archivo sí existe', () => {
    let borrado = null;
    const fsFalso = { existsSync: () => true, unlinkSync: (p) => { borrado = p; } };
    const repo = new ImagenRepository('/tmp/uploads', sharpFalso(), fsFalso);
    repo.eliminarSiExiste('foto.webp');
    assert.match(borrado, /uploads[\\/]foto\.webp$/);
  });
});

describe('ImagenController — los 5 casos documentados en el commit', () => {
  function armarController({ subirImpl, eliminarSiExisteImpl } = {}) {
    const repoFalso = {
      guardarOptimizada: async () => {},
      guardarThumbnail: async () => {},
      eliminarSiExiste: eliminarSiExisteImpl || (() => {}),
    };
    return new ImagenController(new ImagenService({ imagenes: repoFalso }));
  }

  test('1) sin archivo -> 400', async () => {
    const controller = armarController();
    const res = fakeRes();
    await controller.upload({ file: null }, res);
    assert.equal(res._status, 400);
    assert.match(res._json.error, /No se recibió ningún archivo/);
  });

  test('2) extensión inválida -> 400', async () => {
    const controller = armarController();
    const res = fakeRes();
    await controller.upload({ file: { originalname: 'malware.exe', buffer: Buffer.from('x') } }, res);
    assert.equal(res._status, 400);
    assert.match(res._json.error, /Formato no permitido/);
  });

  test('3) happy path -> 201 con url/thumbnail', async () => {
    const controller = armarController();
    const res = fakeRes();
    await controller.upload({ file: { originalname: 'foto.jpg', buffer: Buffer.from('x') } }, res);
    assert.equal(res._status, 201);
    assert.ok(res._json.url);
    assert.ok(res._json.thumbnail);
  });

  test('4) filename inseguro en eliminar -> 400', async () => {
    const controller = armarController();
    const res = fakeRes();
    await controller.eliminar({ params: { filename: '../../etc/passwd' } }, res);
    assert.equal(res._status, 400);
    assert.match(res._json.error, /Nombre de archivo inválido/);
  });

  test('5) eliminar ok -> {ok:true}', async () => {
    let llamados = [];
    const controller = armarController({ eliminarSiExisteImpl: (f) => llamados.push(f) });
    const res = fakeRes();
    await controller.eliminar({ params: { filename: 'foto.webp' } }, res);
    assert.deepEqual(res._json, { ok: true });
    assert.deepEqual(llamados, ['foto.webp', 'foto_thumb.webp']);
  });
});
