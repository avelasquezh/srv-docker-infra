/**
 * Backfill one-off: puebla variables / variable_valores / producto_variables
 * / variantes a partir de los datos hoy vivos en catalogo_precios,
 * atributos, atributo_opciones y catalogo_atributos.
 *
 * No modifica ni borra ninguna tabla vieja. Es idempotente: se puede
 * re-correr sin duplicar filas (usa ON CONFLICT / upsert por nombre).
 *
 * Uso:
 *   node src/db/backfill_variables_variantes.js
 */

const pool = require('../config/db');

// Orden real de tamaños (de menor a mayor), usado para variable_valores.orden
const ORDEN_TAMANIOS = ['Unico', 'Sencillo', 'Semidoble', 'Doble', 'Queen', 'King'];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Variable "Tamaño" (tipo lista)
    const { rows: [varTamanio] } = await client.query(
      `INSERT INTO variables (nombre, tipo)
       VALUES ('Tamaño', 'lista')
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id`
    );

    // 2) Tamaños reales usados en catalogo_precios -> variable_valores
    const { rows: tamaniosDistintos } = await client.query(
      `SELECT DISTINCT tamanio FROM catalogo_precios`
    );
    const valorIdPorTamanio = {};
    for (const { tamanio } of tamaniosDistintos) {
      const orden = ORDEN_TAMANIOS.indexOf(tamanio);
      const { rows: [vv] } = await client.query(
        `INSERT INTO variable_valores (variable_id, valor, orden)
         VALUES ($1, $2, $3)
         ON CONFLICT (variable_id, valor) DO UPDATE SET orden = EXCLUDED.orden
         RETURNING id`,
        [varTamanio.id, tamanio, orden === -1 ? 99 : orden]
      );
      valorIdPorTamanio[tamanio] = vv.id;
    }

    // 3) Variables booleanas: una fila por cada atributo existente en `atributos`
    //    (hoy son "Plumón (extragrueso)" y "Piel de conejo (una cara)", pero no
    //    se hardcodean nombres — se leen de la tabla vieja tal cual estén).
    const { rows: atributosBooleanos } = await client.query(
      `SELECT id, nombre, sobreprecio FROM atributos WHERE tipo = 'booleano' AND activo = true`
    );
    const varIdPorAtributoViejoId = {};
    for (const attr of atributosBooleanos) {
      const { rows: [v] } = await client.query(
        `INSERT INTO variables (nombre, tipo, sobreprecio)
         VALUES ($1, 'booleano', $2)
         ON CONFLICT (nombre) DO UPDATE SET sobreprecio = EXCLUDED.sobreprecio
         RETURNING id`,
        [attr.nombre, attr.sobreprecio]
      );
      varIdPorAtributoViejoId[attr.id] = v.id;
    }

    // 4) Precios base por producto+tamaño (catalogo_precios)
    const { rows: precios } = await client.query(
      `SELECT catalogo_id, tamanio, precio FROM catalogo_precios ORDER BY catalogo_id, tamanio`
    );
    const preciosPorProducto = {};
    for (const p of precios) {
      (preciosPorProducto[p.catalogo_id] ??= []).push(p);
    }

    // 5) Qué productos tienen qué atributos booleanos habilitados (catalogo_atributos)
    const { rows: catalogoAtributos } = await client.query(
      `SELECT ca.catalogo_id, ca.atributo_id, a.nombre AS atributo_nombre
       FROM catalogo_atributos ca
       JOIN atributos a ON a.id = ca.atributo_id`
    );
    const booleanosPorProducto = {};
    for (const ca of catalogoAtributos) {
      (booleanosPorProducto[ca.catalogo_id] ??= []).push(ca);
    }

    // 6) Por cada producto: producto_variables + variantes
    for (const productoId of Object.keys(preciosPorProducto)) {
      const listaPrecios = preciosPorProducto[productoId];
      const idsPermitidos = listaPrecios.map((p) => valorIdPorTamanio[p.tamanio]);

      // producto_variables: Tamaño
      await client.query(
        `INSERT INTO producto_variables (producto_id, variable_id, valores_permitidos)
         VALUES ($1, $2, $3)
         ON CONFLICT (producto_id, variable_id) DO UPDATE SET valores_permitidos = EXCLUDED.valores_permitidos`,
        [productoId, varTamanio.id, idsPermitidos]
      );

      const boolAttrsProducto = booleanosPorProducto[productoId] || [];
      for (const ba of boolAttrsProducto) {
        const varId = varIdPorAtributoViejoId[ba.atributo_id];
        await client.query(
          `INSERT INTO producto_variables (producto_id, variable_id, valores_permitidos)
           VALUES ($1, $2, NULL)
           ON CONFLICT (producto_id, variable_id) DO NOTHING`,
          [productoId, varId]
        );
      }

      // variantes: una por tamaño (base) + una por cada booleano activo de a uno
      // (confirmado: no se generan combinaciones de dos booleanos a la vez)
      for (const p of listaPrecios) {
        const tamanioValorId = valorIdPorTamanio[p.tamanio];

        // variante base (todos los booleanos en false)
        await insertarVariante(client, {
          productoId,
          valores: { [varTamanio.id]: tamanioValorId },
          booleanos: {},
          precio: p.precio,
          skuSufijo: p.tamanio,
        });

        // una variante extra por cada booleano habilitado para este producto
        for (const ba of boolAttrsProducto) {
          const varId = varIdPorAtributoViejoId[ba.atributo_id];
          const attrInfo = atributosBooleanos.find((a) => a.id === ba.atributo_id);
          await insertarVariante(client, {
            productoId,
            valores: { [varTamanio.id]: tamanioValorId },
            booleanos: { [varId]: true },
            precio: Number(p.precio) + Number(attrInfo.sobreprecio),
            skuSufijo: `${p.tamanio}-${slug(attrInfo.nombre)}`,
          });
        }
      }
    }

    // 7) Productos sin fila en catalogo_precios pero con variantes de tamaño único
    //    ya quedan cubiertos arriba porque catalogo_precios sí trae 'Unico' para
    //    almohadas/cortinas. Productos sin ninguna fila en catalogo_precios (si
    //    los hubiera) quedarían sin variante — se listan para revisión manual:
    const { rows: todosProductos } = await client.query(`SELECT id FROM catalogo_productos`);
    const sinPrecio = todosProductos
      .map((r) => r.id)
      .filter((id) => !preciosPorProducto[id]);
    if (sinPrecio.length) {
      console.warn('Productos sin fila en catalogo_precios (revisar manualmente):', sinPrecio);
    }

    await client.query('COMMIT');
    console.log('Backfill completado correctamente.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Backfill falló, se hizo ROLLBACK:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertarVariante(client, { productoId, valores, booleanos, precio, skuSufijo }) {
  const sku = `${productoId}-${skuSufijo}`.toUpperCase().replace(/\s+/g, '-');
  await client.query(
    `INSERT INTO variantes (producto_id, valores, booleanos, precio, sku)
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)
     ON CONFLICT (sku) DO UPDATE SET precio = EXCLUDED.precio, valores = EXCLUDED.valores, booleanos = EXCLUDED.booleanos`,
    [productoId, JSON.stringify(valores), JSON.stringify(booleanos), precio, sku]
  );
}

function slug(texto) {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

main();
