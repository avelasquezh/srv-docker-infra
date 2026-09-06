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

  /** Precio unitario del catálogo legacy para nombre+tamaño. Dependencia
   * conocida de `catalogo_productos`/`catalogo_precios` (ver hallazgo de
   * bloqueante de Fase 6 en la sección 0 del MD) — se preserva tal cual,
   * no se toca en este refactor. */
  async precioCatalogo(nombre, tamanio) {
    const { rows } = await this.query(
      `SELECT cp.precio
       FROM catalogo_productos cat
       JOIN catalogo_precios cp ON cp.catalogo_id = cat.id AND cp.tamanio = $2
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
