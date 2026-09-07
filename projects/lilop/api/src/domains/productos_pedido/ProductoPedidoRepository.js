const BaseRepository = require('../../core/BaseRepository');

/**
 * ProductoPedidoRepository — acceso a datos de las líneas de producto de un
 * pedido (tabla `productos`, anidada bajo `/api/pedidos/:pedido_id/productos`).
 *
 * Bounded context distinto de `domains/productos/` (ese es la porción
 * bot/lectura contra `catalogo_productos`/`variables`, ver sección 7ter del
 * MD de contexto) — mismo nombre de concepto de negocio, responsabilidad
 * completamente distinta, por eso el nombre de carpeta separado
 * (`productos_pedido`, no `productos`).
 */
class ProductoPedidoRepository extends BaseRepository {
  async listarPorPedido(pedidoId) {
    const { rows } = await this.query(
      'SELECT * FROM productos WHERE pedido_id = $1 ORDER BY created_at',
      [pedidoId]
    );
    return rows;
  }

  async obtenerPorId(id) {
    const { rows } = await this.query('SELECT * FROM productos WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async comprasDe(id) {
    const { rows } = await this.query(
      'SELECT * FROM compras WHERE producto_id = $1 ORDER BY created_at',
      [id]
    );
    return rows;
  }

  async pedidoExiste(pedidoId) {
    const { rows } = await this.query('SELECT id FROM pedidos WHERE id = $1', [pedidoId]);
    return rows.length > 0;
  }

  /** Precio de la variante base (solo Tamaño, sin extras) para
   * nombre+tamanio. Desde 008: lee de `variantes`/`atributos_resueltos`
   * (esquema nuevo), ya NO de `catalogo_precios` (legacy) — mismo
   * criterio de match exacto que `fn_recalc_pedido_valor_venta` y
   * `PedidoRepository.productosConCompras()` (ver esa migración para
   * la validación completa de paridad de datos). */
  async precioCatalogo(nombre, tamanio) {
    const { rows } = await this.query(
      `SELECT v.precio
       FROM catalogo_productos cat
       JOIN variantes v ON v.producto_id = cat.id
         AND v.atributos_resueltos = jsonb_build_object('Tamaño', $2::text)
       WHERE cat.nombre = $1
       LIMIT 1`,
      [nombre, tamanio || null]
    );
    return rows[0]?.precio ?? null;
  }

  async camposActuales(id) {
    const { rows } = await this.query(
      'SELECT nombre, tamanio, cantidad FROM productos WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }

  async crear({ pedidoId, nombre, tamanio, diseno, estado, valorVentaOverride, cantidad }) {
    const { rows } = await this.query(
      `INSERT INTO productos (pedido_id, nombre, tamanio, diseno, estado, valor_venta_override, cantidad)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pedidoId, nombre, tamanio || null, diseno || null, estado || 'Por Comprar', valorVentaOverride, cantidad]
    );
    return rows[0];
  }

  async actualizar(id, { nombre, tamanio, diseno, estado, valorVentaOverride, cantidad }) {
    const { rows } = await this.query(
      `UPDATE productos
       SET nombre               = COALESCE($1, nombre),
           tamanio              = COALESCE($2, tamanio),
           diseno               = COALESCE($3, diseno),
           estado               = COALESCE($4, estado),
           valor_venta_override = $5,
           cantidad             = COALESCE($6, cantidad)
       WHERE id = $7
       RETURNING *`,
      [nombre, tamanio, diseno, estado, valorVentaOverride, cantidad || null, id]
    );
    return rows[0] || null;
  }

  async eliminar(id) {
    const { rows } = await this.query('DELETE FROM productos WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  }

  async catalogoNombres() {
    const { rows } = await this.query(
      'SELECT nombre FROM catalogo_productos WHERE activo = true ORDER BY nombre'
    );
    return rows.map((r) => r.nombre);
  }
}

module.exports = ProductoPedidoRepository;
