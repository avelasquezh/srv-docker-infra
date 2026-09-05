const pool = require('../config/db');

// Capa de repositorio: acceso a datos puro, sin lógica de negocio.
// Primera separación real repositorio -> servicio -> controller del
// proyecto (patrón a replicar en el corte real de Fase 5, ver
// projects/lilop/docs/migracion-productos-variantes.md sección 5).

/**
 * Lista todos los productos activos con sus variables (qué preguntar)
 * y sus variantes (atributos_resueltos + precio ya calculado).
 * Ningún join a mano: atributos_resueltos ya viene resuelto por el
 * trigger de Postgres (ver migración 002_variables_variantes.sql).
 */
async function listarProductosConVariantes() {
  const { rows } = await pool.query(`
    SELECT
      c.id, c.nombre, c.descripcion_corta,
      (
        SELECT json_agg(json_build_object(
          'nombre', v.nombre,
          'tipo', v.tipo,
          'valores', (
            SELECT json_agg(vv.valor ORDER BY vv.orden)
            FROM variable_valores vv
            WHERE vv.variable_id = v.id
              AND (pv.valores_permitidos IS NULL OR vv.id = ANY(pv.valores_permitidos))
          )
        ))
        FROM producto_variables pv
        JOIN variables v ON v.id = pv.variable_id
        WHERE pv.producto_id = c.id AND v.activo = true
      ) AS variables,
      (
        SELECT json_agg(json_build_object(
          'id', vt.id,
          'atributos', vt.atributos_resueltos,
          'precio', vt.precio,
          'stock', vt.stock
        ) ORDER BY vt.precio)
        FROM variantes vt
        WHERE vt.producto_id = c.id AND vt.activo = true
      ) AS variantes
    FROM catalogo_productos c
    WHERE c.activo = true
    ORDER BY c.nombre
  `);
  return rows;
}

/**
 * Mismo shape que listarProductosConVariantes pero para un solo
 * producto por id de catálogo (ej. CAT0032).
 */
async function obtenerProductoConVariantes(catalogoId) {
  const { rows } = await pool.query(`
    SELECT
      c.id, c.nombre, c.descripcion_corta,
      (
        SELECT json_agg(json_build_object(
          'nombre', v.nombre,
          'tipo', v.tipo,
          'valores', (
            SELECT json_agg(vv.valor ORDER BY vv.orden)
            FROM variable_valores vv
            WHERE vv.variable_id = v.id
              AND (pv.valores_permitidos IS NULL OR vv.id = ANY(pv.valores_permitidos))
          )
        ))
        FROM producto_variables pv
        JOIN variables v ON v.id = pv.variable_id
        WHERE pv.producto_id = c.id AND v.activo = true
      ) AS variables,
      (
        SELECT json_agg(json_build_object(
          'id', vt.id,
          'atributos', vt.atributos_resueltos,
          'precio', vt.precio,
          'stock', vt.stock
        ) ORDER BY vt.precio)
        FROM variantes vt
        WHERE vt.producto_id = c.id AND vt.activo = true
      ) AS variantes
    FROM catalogo_productos c
    WHERE c.activo = true AND c.id = $1
  `, [catalogoId]);
  return rows[0] || null;
}

module.exports = { listarProductosConVariantes, obtenerProductoConVariantes };
