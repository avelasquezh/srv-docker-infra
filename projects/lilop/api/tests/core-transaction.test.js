const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const BaseRepository = require('../src/core/BaseRepository');

function fakePool(client) {
  return { connect: async () => client };
}

describe('BaseRepository.transaction()', () => {
  test('hace BEGIN, corre fn, COMMIT, y libera el client', async () => {
    const llamadas = [];
    const client = {
      query: async (sql) => llamadas.push(sql),
      release: () => llamadas.push('RELEASE'),
    };
    const repo = new BaseRepository(fakePool(client));
    const resultado = await repo.transaction(async (c) => { llamadas.push('FN'); return 42; });
    assert.equal(resultado, 42);
    assert.deepEqual(llamadas, ['BEGIN', 'FN', 'COMMIT', 'RELEASE']);
  });

  test('si fn lanza error, hace ROLLBACK, libera el client, y propaga el error', async () => {
    const llamadas = [];
    const client = {
      query: async (sql) => llamadas.push(sql),
      release: () => llamadas.push('RELEASE'),
    };
    const repo = new BaseRepository(fakePool(client));
    await assert.rejects(
      () => repo.transaction(async () => { throw new Error('boom'); }),
      /boom/
    );
    assert.deepEqual(llamadas, ['BEGIN', 'ROLLBACK', 'RELEASE']);
  });
});
