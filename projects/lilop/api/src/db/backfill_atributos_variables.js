/**
 * Backfill one-off: migra atributos/catalogo_atributos (legacy, IDs
 * integer) al esquema nuevo variables/producto_variables (IDs TEXT con
 * prefijo). Aditivo — no toca ni borra las tablas viejas.
 *
 * Alcance real confirmado contra producción antes de escribir esto
 * (ver sección 7quinquies del MD): 2 filas en `atributos`, ambas
 * tipo='booleano'; 0 filas en `atributo_opciones` (nada tipo lista que
 * migrar); 16 filas en `catalogo_atributos`. El check constraint real
 * de `atributos.tipo` permite 'booleano'|'seleccion' (no 'lista' como
 * se asumía en el plan original) — se mapea 'seleccion' -> 'lista' por
 * si en el futuro aparece alguno, aunque hoy no hay ninguno.
 *
 * Idempotente (ON CONFLICT por nombre / por combinación única).
 *
 * Uso:
 *   node src/db/backfill_atributos_variables.js
 */
const pool = require('../config/db');

const MAPA_TIPO = { booleano: 'booleano', seleccion: 'lista' };

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) atributos -> variables (mapeo por id viejo -> id nuevo, en memoria)
    const { rows: atributosViejos } = await client.query('SELECT * FROM atributos');
    const idNuevoPorIdViejo = {};

    for (const a of atributosViejos) {
      const tipoNuevo = MAPA_TIPO[a.tipo];
      if (!tipoNuevo) {
        throw new Error(`Tipo de atributo desconocido: '${a.tipo}' (atributo id=${a.id}, nombre='${a.nombre}') — revisar antes de continuar, no asumir`);
      }
      const { rows: [v] } = await client.query(
        `INSERT INTO variables (nombre, tipo, sobreprecio, activo)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (nombre) DO UPDATE SET tipo = EXCLUDED.tipo, sobreprecio = EXCLUDED.sobreprecio, activo = EXCLUDED.activo
         RETURNING id`,
        [a.nombre, tipoNuevo, a.sobreprecio, a.activo]
      );
      idNuevoPorIdViejo[a.id] = v.id;
    }
    console.log(`variables: ${Object.keys(idNuevoPorIdViejo).length} atributo(s) mapeado(s):`, idNuevoPorIdViejo);

    // 2) atributo_opciones -> variable_valores (solo si aplica; hoy no hay ninguna fila)
    const { rows: opcionesViejas } = await client.query('SELECT * FROM atributo_opciones');
    for (const o of opcionesViejas) {
      const variableId = idNuevoPorIdViejo[o.atributo_id];
      if (!variableId) continue; // no debería pasar (FK), pero no asumir
      await client.query(
        `INSERT INTO variable_valores (variable_id, valor)
         VALUES ($1, $2)
         ON CONFLICT (variable_id, valor) DO NOTHING`,
        [variableId, o.valor]
      );
    }
    if (opcionesViejas.length) console.log(`variable_valores: ${opcionesViejas.length} opción(es) migrada(s)`);
    else console.log('variable_valores: 0 filas en atributo_opciones, nada que migrar (esperado)');

    // 3) catalogo_atributos -> producto_variables (valores_permitidos = NULL, son todas tipo booleano hoy)
    const { rows: asignaciones } = await client.query('SELECT * FROM catalogo_atributos');
    let contadorAsignaciones = 0;
    for (const ca of asignaciones) {
      const variableId = idNuevoPorIdViejo[ca.atributo_id];
      if (!variableId) continue;
      await client.query(
        `INSERT INTO producto_variables (producto_id, variable_id, valores_permitidos)
         VALUES ($1, $2, NULL)
         ON CONFLICT (producto_id, variable_id) DO NOTHING`,
        [ca.catalogo_id, variableId]
      );
      contadorAsignaciones++;
    }
    console.log(`producto_variables: ${contadorAsignaciones} asignación(es) procesada(s) de ${asignaciones.length} en catalogo_atributos`);

    await client.query('COMMIT');
    console.log('Backfill de atributos->variables completado correctamente.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Backfill falló, se hizo ROLLBACK:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
