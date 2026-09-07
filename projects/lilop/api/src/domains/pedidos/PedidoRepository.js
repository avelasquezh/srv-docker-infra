const BaseRepository = require('../../core/BaseRepository');

/**
 * PedidoRepository — acceso a datos del dominio `pedidos`.
 *
 * Ver sección 0 del MD de contexto para el detalle completo del esquema
 * real (as-built, migraciones 005/006): `estado_pedido`/`estado_pago_pedido`
 * son enums, `ganancias` la calcula un trigger (`fn_recalc_ganancias`,
 * no una columna GENERATED), `valor_venta` lo recalcula otro trigger
 * (`fn_recalc_pedido_valor_venta`) cuando cambian los productos del pedido
 * — este repository nunca escribe esas dos columnas directamente salvo
 * en `crear`, donde `valor_venta` es el valor inicial que manda el admin
 * (el trigger lo sobrescribe después, en cuanto se agregan productos).
 */
class PedidoRepository extends BaseRepository {
  async listar({ estado, vendedor_id: vendedorId, cliente_id: clienteId, desde, hasta }) {
    let sql = 'SELECT * FROM v_pedidos_resumen WHERE 1=1';
    const params = [];
    let i = 1;

    if (estado)     { sql += ` AND estado = $${i++}`;       params.push(estado); }
    if (vendedorId) { sql += ` AND vendedor_id = $${i++}`;  params.push(vendedorId); }
    if (clienteId)  { sql += ` AND cliente_id = $${i++}`;   params.push(clienteId); }
    if (desde)      { sql += ` AND fecha_venta >= $${i++}`; params.push(desde); }
    if (hasta)      { sql += ` AND fecha_venta <= $${i++}`; params.push(hasta); }

    sql += ' ORDER BY fecha_venta DESC';

    const { rows } = await this.query(sql, params);
    return rows;
  }

  async obtenerResumen(id) {
    const { rows } = await this.query('SELECT * FROM v_pedidos_resumen WHERE id = $1', [id]);
    return rows[0] || null;
  }

  /** Productos del pedido con su precio de la variante base (solo Tamaño,
   * sin extras) y sus compras agregadas. Desde 008: lee de `variantes`/
   * `atributos_resueltos` (esquema nuevo), ya NO de `catalogo_precios`
   * (legacy) — mismo criterio de match exacto que el trigger
   * `fn_recalc_pedido_valor_venta` (ver esa migración para la
   * validación completa de paridad de datos). */
  async productosConCompras(pedidoId) {
    const { rows } = await this.query(
      `SELECT pr.*,
        v.precio AS valor_venta,
        json_agg(
          json_build_object('concepto', c.concepto, 'valor', c.valor_total)
          ORDER BY c.created_at
        ) FILTER (WHERE c.id IS NOT NULL) AS compras
       FROM productos pr
       LEFT JOIN catalogo_productos cat ON cat.nombre = pr.nombre
       LEFT JOIN variantes v ON v.producto_id = cat.id
         AND v.atributos_resueltos = jsonb_build_object('Tamaño', pr.tamanio::text)
       LEFT JOIN compras c ON c.producto_id = pr.id
       WHERE pr.pedido_id = $1
       GROUP BY pr.id, v.precio
       ORDER BY pr.created_at`,
      [pedidoId]
    );
    return rows;
  }

  async buscarMedioPago(nombre) {
    const { rows } = await this.query('SELECT id FROM medios_pago WHERE nombre = $1', [nombre]);
    return rows[0]?.id ?? null;
  }

  async crear({ clienteId, vendedorId, fechaEntrega, valorVenta, valorDomicilio, domiciliario, medioPagoId, estado, notas }) {
    const { rows } = await this.query(
      `INSERT INTO pedidos
         (cliente_id, vendedor_id, fecha_entrega, valor_venta,
          valor_domicilio, domiciliario, medio_pago_id, estado, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [clienteId, vendedorId, fechaEntrega || null, valorVenta,
       valorDomicilio || 0, domiciliario || null, medioPagoId,
       estado || 'por_confirmar', notas || null]
    );
    return rows[0];
  }

  async actualizar(id, { fechaEntrega, valorVenta, valorDomicilio, domiciliario, medioPagoId, estado, notas, vendedorId }) {
    const { rows } = await this.query(
      `UPDATE pedidos
       SET fecha_entrega   = COALESCE($1,  fecha_entrega),
           valor_venta     = COALESCE($2,  valor_venta),
           valor_domicilio = COALESCE($3,  valor_domicilio),
           domiciliario    = COALESCE($4,  domiciliario),
           medio_pago_id   = COALESCE($5,  medio_pago_id),
           estado          = COALESCE($6,  estado),
           notas           = COALESCE($7,  notas),
           vendedor_id     = COALESCE($8,  vendedor_id)
       WHERE id = $9
       RETURNING *`,
      [fechaEntrega, valorVenta, valorDomicilio, domiciliario, medioPagoId, estado, notas, vendedorId, id]
    );
    return rows[0] || null;
  }

  async cambiarEstado(id, estado) {
    const { rows } = await this.query(
      'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING id, estado',
      [estado, id]
    );
    return rows[0] || null;
  }

  async eliminar(id) {
    const { rows } = await this.query('DELETE FROM pedidos WHERE id = $1 RETURNING id', [id]);
    return rows[0] || null;
  }
}

module.exports = PedidoRepository;
