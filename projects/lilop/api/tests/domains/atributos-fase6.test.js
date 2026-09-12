const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const AtributoRepository = require('../../src/domains/atributos/AtributoRepository');

function poolEspia(respuesta = { rows: [] }) {
  const llamadas = [];
  return { llamadas, query: async (sql, params) => { llamadas.push({ sql, params }); return respuesta; } };
}

describe('AtributoRepository — repunte a variables/producto_variables (Fase 6)', () => {
  test('listar() excluye explícitamente la variable "Tamaño"', async () => {
    const pool = poolEspia();
    await new AtributoRepository(pool).listar();
    assert.match(pool.llamadas[0].sql, /WHERE var\.nombre <> 'Tamaño'/);
    assert.ok(!pool.llamadas[0].sql.includes('atributos'), 'ya no debe referenciar la tabla legacy');
  });

  test('listarPorProducto() excluye "Tamaño" (no debe mostrarse como atributo togglable)', async () => {
    const pool = poolEspia();
    await new AtributoRepository(pool).listarPorProducto('CAT0032');
    assert.match(pool.llamadas[0].sql, /var\.nombre <> 'Tamaño'/);
  });

  test('CRÍTICO: reemplazarAtributosProducto() nunca borra la fila de Tamaño del producto, y es transaccional', async () => {
    const llamadas = [];
    const client = { query: async (sql, params) => { llamadas.push({ sql, params }); }, release: () => {} };
    const pool = { connect: async () => client };
    await new AtributoRepository(pool).reemplazarAtributosProducto('CAT0032', ['VAR0002']);
    assert.equal(llamadas[0].sql, 'BEGIN');
    const deleteCall = llamadas.find((c) => c.sql.includes('DELETE FROM producto_variables'));
    assert.ok(deleteCall, 'debe ejecutar un DELETE');
    assert.match(deleteCall.sql, /variable_id IN \(SELECT id FROM variables WHERE nombre <> 'Tamaño'\)/);
    assert.ok(llamadas.some((c) => c.sql === 'COMMIT'));
  });

  test('reemplazarAtributosProducto() con ID inválido hace ROLLBACK completo (no deja el producto a medias)', async () => {
    const llamadas = [];
    const client = {
      query: async (sql) => {
        llamadas.push(sql);
        if (sql.startsWith('INSERT')) throw Object.assign(new Error('violates foreign key constraint'), { code: '23503' });
      },
      release: () => {},
    };
    const pool = { connect: async () => client };
    await assert.rejects(
      () => new AtributoRepository(pool).reemplazarAtributosProducto('CAT0032', ['ID_INVALIDO']),
      /foreign key/
    );
    assert.ok(llamadas.includes('ROLLBACK'), 'debe hacer ROLLBACK, no dejar el DELETE sin el INSERT');
  });

  test('actualizar()/eliminar() nunca pueden tocar la variable "Tamaño" (guardado en el propio WHERE)', async () => {
    const pool = poolEspia();
    const repo = new AtributoRepository(pool);
    await repo.actualizar('VAR0001', { nombre: 'x' });
    await repo.eliminar('VAR0001');
    for (const c of pool.llamadas) assert.match(c.sql, /nombre <> 'Tamaño'/);
  });

  test('traduce tipo de salida: lista -> seleccion (vocabulario del admin viejo), booleano se mantiene', async () => {
    const pool = poolEspia({ rows: [{ id: 'VAR0009', nombre: 'Color', tipo: 'lista', sobreprecio: 0 }] });
    const [fila] = await new AtributoRepository(pool).listar();
    assert.equal(fila.tipo, 'seleccion');

    const poolBool = poolEspia({ rows: [{ id: 'VAR0002', nombre: 'Piel de conejo', tipo: 'booleano', sobreprecio: 25000 }] });
    const [filaBool] = await new AtributoRepository(poolBool).listar();
    assert.equal(filaBool.tipo, 'booleano');
  });

  test('crear() traduce tipo de entrada: seleccion -> lista', async () => {
    const pool = poolEspia({ rows: [{ id: 'VAR0009', nombre: 'Color', tipo: 'lista', sobreprecio: 0 }] });
    await new AtributoRepository(pool).crear({ nombre: 'Color', tipo: 'seleccion', sobreprecio: 0 });
    assert.deepEqual(pool.llamadas[0].params, ['Color', 'lista', 0]);
  });

  test('crearOpcion() mapea valor -> {nombre, valor} en la salida (variable_valores no distingue ambos)', async () => {
    const pool = poolEspia({ rows: [{ id: 'VVA0099', variable_id: 'VAR0009', valor: 'Rojo' }] });
    const resultado = await new AtributoRepository(pool).crearOpcion('VAR0009', { valor: 'Rojo' });
    assert.deepEqual(resultado, { id: 'VVA0099', atributo_id: 'VAR0009', nombre: 'Rojo', valor: 'Rojo' });
  });
});
