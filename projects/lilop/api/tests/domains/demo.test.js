const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const DemoRepository = require('../../src/domains/demo/DemoRepository');
const DemoService = require('../../src/domains/demo/DemoService');
const DemoController = require('../../src/domains/demo/DemoController');

function fakeRes() {
  return { _status: 200, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

function poolFalso() {
  const ejecuciones = {
    1: { id: 1, test_case_id: 'TC1', status: 'running', result: null,
      steps: [{ key: 'received', status: 'pending' }, { key: 'auth', status: 'pending' }],
      created_at: null, completed_at: null },
  };
  return {
    query: async (sql, params) => {
      if (/INSERT INTO demo_executions/.test(sql)) {
        ejecuciones[2] = { id: 2, steps: JSON.parse(params[1]) };
        return { rows: [{ id: 2 }] };
      }
      if (/SELECT id, test_case_id[\s\S]*FROM demo_executions WHERE id/.test(sql)) {
        const e = ejecuciones[params[0]];
        return { rows: e ? [e] : [] };
      }
      if (/SELECT steps FROM demo_executions/.test(sql)) {
        const e = ejecuciones[params[0]];
        return { rows: e ? [{ steps: e.steps }] : [] };
      }
      if (/UPDATE demo_executions/.test(sql)) {
        ejecuciones[params[4]].steps = JSON.parse(params[0]);
        ejecuciones[params[4]].status = params[1];
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

function buildController({ fetchImpl, webhookUrl } = {}) {
  const repo = new DemoRepository(poolFalso());
  const service = new DemoService({ demo: repo }, { fetchImpl, webhookUrl });
  return new DemoController(service);
}

describe('DemoService — sin webhookUrl (env var ausente en prod)', () => {
  test('constructor NO lanza si falta webhookUrl (a diferencia de AuthService)', () => {
    assert.doesNotThrow(() => new DemoService({}, {}));
  });

  test('run() con webhookUrl undefined no crashea y responde ok', async () => {
    const c = buildController({});
    const res = fakeRes();
    await c.run({ body: { test_case_id: 'TC1', correo: 'x@x.com' } }, res);
    assert.equal(res._status, 200);
    assert.equal(res._json.ok, true);
  });
});

describe('DemoController', () => {
  test('run() sin correo responde 400', async () => {
    const c = buildController({ webhookUrl: 'https://n8n.test/webhook' });
    const res = fakeRes();
    await c.run({ body: {} }, res);
    assert.equal(res._status, 400);
  });

  test('run() dispara el webhook con el payload correcto (fire-and-forget)', async () => {
    let capturado = null;
    const fetchFalso = async (url, opts) => { capturado = { url, body: JSON.parse(opts.body) }; return { ok: true }; };
    const c = buildController({ fetchImpl: fetchFalso, webhookUrl: 'https://n8n.test/webhook' });
    const res = fakeRes();
    await c.run({ body: { test_case_id: 'TC1', correo: 'x@x.com', empresa: 'ACME' } }, res);
    assert.equal(res._status, 200);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(capturado.url, 'https://n8n.test/webhook');
    assert.equal(capturado.body.test_case_id, 'TC1');
    assert.equal(capturado.body.empresa, 'ACME');
  });

  test('status() con id existente responde 200 con la ejecución', async () => {
    const c = buildController({ webhookUrl: 'https://n8n.test/webhook' });
    const res = fakeRes();
    await c.status({ params: { id: 1 } }, res);
    assert.equal(res._status, 200);
    assert.equal(res._json.test_case_id, 'TC1');
  });

  test('status() con id inexistente responde 404', async () => {
    const c = buildController({ webhookUrl: 'https://n8n.test/webhook' });
    const res = fakeRes();
    await c.status({ params: { id: 999 } }, res);
    assert.equal(res._status, 404);
  });

  test('updateStep() marca el paso y responde ok', async () => {
    const c = buildController({ webhookUrl: 'https://n8n.test/webhook' });
    const res = fakeRes();
    await c.updateStep({ params: { id: 1 }, body: { step_key: 'received', status: 'done' } }, res);
    assert.equal(res._status, 200);
    assert.equal(res._json.ok, true);
  });

  test('updateStep() con id inexistente responde 404', async () => {
    const c = buildController({ webhookUrl: 'https://n8n.test/webhook' });
    const res = fakeRes();
    await c.updateStep({ params: { id: 999 }, body: { step_key: 'received', status: 'done' } }, res);
    assert.equal(res._status, 404);
  });
});
