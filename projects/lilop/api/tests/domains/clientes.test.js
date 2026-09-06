const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ClienteService = require('../../src/domains/clientes/ClienteService');
const ClienteController = require('../../src/domains/clientes/ClienteController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

describe('ClienteService', () => {
  test('crear() aplica title-case al nombre (nota: bug pre-existente con acentos, ver controllers/clientes.js original — \\b\\w no trata í/ó como letra, no se corrige aquí para no cambiar comportamiento fuera de alcance)', async () => {
    let capturado;
    const repoFalso = { crear: async (d) => { capturado = d; return d; } };
    await new ClienteService({ clientes: repoFalso }).crear({ nombre: 'maría lópez' });
    assert.equal(capturado.nombre, 'MaríA LóPez');
  });

  test('crear() con nombre sin acentos funciona correctamente', async () => {
    let capturado;
    const repoFalso = { crear: async (d) => { capturado = d; return d; } };
    await new ClienteService({ clientes: repoFalso }).crear({ nombre: 'juan perez' });
    assert.equal(capturado.nombre, 'Juan Perez');
  });
});

describe('ClienteController', () => {
  test('crear() sin nombre responde 400', async () => {
    const controller = new ClienteController(new ClienteService({}));
    const res = fakeRes();
    await controller.crear({ body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('actualizar() con celular ya usado por otro cliente responde 409, no llega a actualizar', async () => {
    let seActualizo = false;
    const repoFalso = { celularEnUso: async () => true, actualizar: async () => { seActualizo = true; } };
    const controller = new ClienteController(new ClienteService({ clientes: repoFalso }));
    const res = fakeRes();
    await controller.actualizar({ params: { id: 'CL0001' }, body: { celular: '3001234567' } }, res);
    assert.equal(res._status, 409);
    assert.equal(seActualizo, false);
  });

  test('actualizar() sin cambiar celular no valida duplicado', async () => {
    let seValido = false;
    const repoFalso = { celularEnUso: async () => { seValido = true; return true; }, actualizar: async () => ({ id: 'CL0001' }) };
    const controller = new ClienteController(new ClienteService({ clientes: repoFalso }));
    const res = fakeRes();
    await controller.actualizar({ params: { id: 'CL0001' }, body: { nombre: 'Ana' } }, res);
    assert.equal(seValido, false);
    assert.equal(res._status, 200);
  });

  test('eliminar() con pedidos existentes responde 400, no borra', async () => {
    let seElimino = false;
    const repoFalso = { tienePedidos: async () => true, eliminar: async () => { seElimino = true; } };
    const controller = new ClienteController(new ClienteService({ clientes: repoFalso }));
    const res = fakeRes();
    await controller.eliminar({ params: { id: 'CL0001' } }, res);
    assert.equal(res._status, 400);
    assert.equal(seElimino, false);
  });

  test('eliminar() sin pedidos, happy path', async () => {
    const repoFalso = { tienePedidos: async () => false, eliminar: async () => ({ id: 'CL0001' }) };
    const controller = new ClienteController(new ClienteService({ clientes: repoFalso }));
    const res = fakeRes();
    await controller.eliminar({ params: { id: 'CL0001' } }, res);
    assert.deepEqual(res._json, { mensaje: 'Cliente eliminado correctamente' });
  });

  test('obtener() con id inexistente responde 404', async () => {
    const repoFalso = { obtenerPorId: async () => null };
    const controller = new ClienteController(new ClienteService({ clientes: repoFalso }));
    const res = fakeRes();
    await controller.obtener({ params: { id: 'CL9999' } }, res);
    assert.equal(res._status, 404);
  });
});
