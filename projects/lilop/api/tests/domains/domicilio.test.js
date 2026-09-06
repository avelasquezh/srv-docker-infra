const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const DomicilioRepository = require('../../src/domains/domicilio/DomicilioRepository');
const DomicilioService = require('../../src/domains/domicilio/DomicilioService');
const DomicilioController = require('../../src/domains/domicilio/DomicilioController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

describe('DomicilioRepository', () => {
  test('exige webhookUrl inyectada', () => {
    assert.throws(() => new DomicilioRepository(), /se requiere webhookUrl inyectada/);
  });

  test('enviar() hace POST al webhook con pedido_id + payload', async () => {
    let capturado = null;
    const fetchFalso = async (url, opts) => { capturado = { url, opts }; return { ok: true }; };
    const repo = new DomicilioRepository('https://ejemplo.test/webhook', fetchFalso);
    await repo.enviar('PD0062', { direccion: 'Calle 1' });
    assert.equal(capturado.url, 'https://ejemplo.test/webhook');
    assert.deepEqual(JSON.parse(capturado.opts.body), { pedido_id: 'PD0062', direccion: 'Calle 1' });
  });

  test('enviar() lanza error si el webhook responde no-ok', async () => {
    const fetchFalso = async () => ({ ok: false, status: 503 });
    const repo = new DomicilioRepository('https://ejemplo.test/webhook', fetchFalso);
    await assert.rejects(() => repo.enviar('PD0062', {}), /Webhook error 503/);
  });
});

describe('DomicilioController', () => {
  test('enviar() responde {ok:true} en el happy path', async () => {
    const repoFalso = { enviar: async () => true };
    const controller = new DomicilioController(new DomicilioService({ domicilio: repoFalso }));
    const res = fakeRes();
    await controller.enviar({ params: { id: 'PD0062' }, body: { direccion: 'Calle 1' } }, res);
    assert.deepEqual(res._json, { ok: true });
  });

  test('enviar() con repo que lanza error responde 500 genérico (mismo código que antes, mensaje ahora estándar)', async () => {
    const repoRoto = { enviar: async () => { throw new Error('Webhook error 503'); } };
    const controller = new DomicilioController(new DomicilioService({ domicilio: repoRoto }));
    const res = fakeRes();
    await controller.enviar({ params: { id: 'PD0062' }, body: {} }, res);
    assert.equal(res._status, 500);
  });
});
