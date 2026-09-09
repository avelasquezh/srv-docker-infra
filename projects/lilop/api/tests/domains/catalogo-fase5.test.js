const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CatalogoRepository = require('../../src/domains/catalogo/CatalogoRepository');

function poolSecuencial(respuestas) {
  let i = 0;
  const llamadas = [];
  return {
    llamadas,
    query: async (sql, params) => { llamadas.push({ sql, params }); return respuestas[i++] ?? { rows: [] }; },
  };
}

describe('CatalogoRepository — corte de Fase 5 (precios contra variantes)', () => {
  test('listar()/listarPublicoRaw() ya no referencian catalogo_precios, sí variantes con filtro de variante base', async () => {
    const pool = { query: async (sql) => { pool.sql = sql; return { rows: [] }; } };
    const repo = new CatalogoRepository(pool);

    await repo.listar();
    assert.ok(!pool.sql.includes('catalogo_precios'));
    assert.match(pool.sql, /FROM variantes vt/);
    assert.match(pool.sql, /vt\.atributos_resueltos - 'Tamaño' = '\{\}'::jsonb/);

    await repo.listarPublicoRaw();
    assert.ok(!pool.sql.includes('catalogo_precios'));
    assert.match(pool.sql, /FROM variantes vt/);
  });

  test('upsertPrecio() con precio <= 0 elimina la variante base de ese tamaño (no toca catalogo_precios)', async () => {
    const pool = poolSecuencial([
      { rows: [{ id: 'VAR0001' }] },       // _obtenerVariableTamanio
      { rows: [{ id: 'VVA0002' }] },       // _obtenerOCrearValorTamanio
      { rows: [] },                        // DELETE
    ]);
    const repo = new CatalogoRepository(pool);
    const resultado = await repo.upsertPrecio('CAT0032', { tamanio: 'Doble', precio: 0 });
    assert.deepEqual(resultado, { ok: true, eliminado: true });
    const deleteCall = pool.llamadas.find((c) => c.sql.includes('DELETE FROM variantes'));
    assert.ok(deleteCall, 'debe ejecutar DELETE sobre variantes');
    assert.ok(!deleteCall.sql.includes('catalogo_precios'));
  });

  test('upsertPrecio() con precio > 0: asegura variable_valor, habilita el tamaño en producto_variables, y hace upsert de la variante', async () => {
    const pool = poolSecuencial([
      { rows: [{ id: 'VAR0001' }] },                          // _obtenerVariableTamanio (ya existe)
      { rows: [] },                                           // _obtenerOCrearValorTamanio: no existe -> crea
      { rows: [{ id: 'VVA0099' }] },                          // INSERT variable_valores
      { rows: [] },                                           // _asegurarValorPermitido: no hay fila -> crea
      { rows: [] },                                           // INSERT producto_variables
      { rows: [{ id: 'VTE0200', producto_id: 'CAT0099', atributos_resueltos: { Tamaño: 'Queen' }, precio: '175000.00' }] }, // upsert variante
    ]);
    const repo = new CatalogoRepository(pool);
    const resultado = await repo.upsertPrecio('CAT0099', { tamanio: 'Queen', precio: 175000 });
    assert.deepEqual(resultado, { id: 'VTE0200', catalogo_id: 'CAT0099', tamanio: 'Queen', precio: '175000.00' });

    const upsertCall = pool.llamadas[pool.llamadas.length - 1];
    assert.match(upsertCall.sql, /INSERT INTO variantes/);
    assert.match(upsertCall.sql, /ON CONFLICT \(sku\)/);
    assert.deepEqual(upsertCall.params, ['CAT0099', 'VAR0001', 'VVA0099', 175000, 'CAT0099-QUEEN']);
  });

  test('upsertPrecio() no vuelve a insertar en producto_variables si el tamaño ya estaba permitido', async () => {
    const pool = poolSecuencial([
      { rows: [{ id: 'VAR0001' }] },
      { rows: [{ id: 'VVA0002' }] },
      { rows: [{ valores_permitidos: ['VVA0002', 'VVA0003'] }] }, // ya permitido
      { rows: [{ id: 'VTE0001', producto_id: 'CAT0032', atributos_resueltos: { Tamaño: 'Doble' }, precio: '135000.00' }] },
    ]);
    const repo = new CatalogoRepository(pool);
    await repo.upsertPrecio('CAT0032', { tamanio: 'Doble', precio: 135000 });
    const huboInsertProductoVariables = pool.llamadas.some((c) => c.sql.includes('INSERT INTO producto_variables'));
    assert.equal(huboInsertProductoVariables, false);
  });
});
