const BaseRepository = require('../../core/BaseRepository');

/**
 * ProductoRepository — acceso a datos del catálogo (esquema nuevo:
 * catalogo_productos + variables/variantes). Reemplaza a la versión
 * funcional repositories/productosBot.js (mismo SQL, sin cambios de
 * comportamiento — solo estructura).
 */
class ProductoRepository extends BaseRepository {
  /**
   * Todos los productos activos, con sus variables (qué preguntar) y
   * variantes (atributos_resueltos + precio ya calculado por el trigger
   * de Postgres — ver migración 002_variables_variantes.sql).
   */
  async listarConVariantes() {
    const { rows } = await this.query(`
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
            'precio', vt.precio
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

  /** Mismo shape que listarConVariantes pero para un solo producto (ej. CAT0032). */
  async obtenerConVariantes(catalogoId) {
    const { rows } = await this.query(`
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
            'precio', vt.precio
          ) ORDER BY vt.precio)
          FROM variantes vt
          WHERE vt.producto_id = c.id AND vt.activo = true
        ) AS variantes
      FROM catalogo_productos c
      WHERE c.activo = true AND c.id = $1
    `, [catalogoId]);
    return rows[0] || null;
  }
}

module.exports = ProductoRepository;
